use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ChartsStatus {
    enabled: bool,
    needs_pick: bool,
    cancelled: bool,
    folders: Vec<String>,
    root: String,
}

#[derive(Serialize)]
struct ChartFile {
    name: String,
    text: String,
}

#[derive(Serialize)]
struct FolderPayload {
    charts: Vec<ChartFile>,
    music: Vec<String>,
}

#[derive(Serialize)]
struct ReadPayload {
    name: String,
    mime: String,
    text: Option<String>,
    base64: Option<String>,
}

#[derive(Serialize)]
struct WritePayload {
    ok: bool,
    verified: bool,
}

fn config_file() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("MDCE").join("chart-root.txt")
}

fn saved_root() -> Option<PathBuf> {
    let text = fs::read_to_string(config_file()).ok()?;
    let path = PathBuf::from(text.trim());
    if path.is_dir() { Some(path) } else { None }
}

fn dir_has_bms(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else { return false };
    entries.flatten().any(|entry| {
        entry.file_type().map(|kind| kind.is_file()).unwrap_or(false) && is_bms(&entry.file_name().to_string_lossy())
    })
}

fn list_song_folders(root: &Path) -> Vec<String> {
    let mut folders = Vec::new();
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let Ok(kind) = entry.file_type() else { continue };
            if !kind.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            folders.push(name);
        }
    }
    if folders.is_empty() && dir_has_bms(root) {
        if let Some(name) = root.file_name().and_then(|name| name.to_str()) {
            folders.push(name.to_string());
        }
    }
    folders.sort();
    folders
}

fn song_dir(folder: &str) -> Result<PathBuf, String> {
    let root = saved_root().ok_or_else(|| "No chart folder selected".to_string())?;
    let nested = root.join(folder);
    if nested.is_dir() {
        return Ok(nested);
    }
    if root.file_name().and_then(|name| name.to_str()) == Some(folder) && root.is_dir() {
        return Ok(root);
    }
    Err("Chart folder is missing".into())
}

fn status_of(cancelled: bool) -> ChartsStatus {
    match saved_root() {
        Some(root) => ChartsStatus {
            enabled: true,
            needs_pick: false,
            cancelled,
            folders: list_song_folders(&root),
            root: root.display().to_string(),
        },
        None => ChartsStatus {
            enabled: true,
            needs_pick: true,
            cancelled,
            folders: Vec::new(),
            root: String::new(),
        },
    }
}

#[tauri::command]
fn charts_status() -> ChartsStatus {
    status_of(false)
}

#[tauri::command]
fn charts_pick_root() -> ChartsStatus {
    let picked = rfd::FileDialog::new().set_title("Select chart folder").pick_folder();
    let Some(path) = picked else {
        return status_of(true);
    };
    if !path.is_dir() {
        return status_of(true);
    }
    let file = config_file();
    if let Some(parent) = file.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if fs::write(&file, path.to_string_lossy().as_bytes()).is_err() {
        return status_of(true);
    }
    status_of(false)
}

fn safe_name(value: &str) -> Result<String, String> {
    let text = value.trim();
    if text.is_empty() || text == "." || text == ".." {
        return Err("Invalid name".into());
    }
    if text.contains('/') || text.contains('\\') || text.contains('\0') {
        return Err("Invalid name".into());
    }
    Ok(text.to_string())
}

fn is_bms(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".bms") || lower.ends_with(".bme") || lower.ends_with(".bml")
}

fn is_audio(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".ogg")
        || lower.ends_with(".mp3")
        || lower.ends_with(".wav")
        || lower.ends_with(".flac")
        || lower.ends_with(".m4a")
}

fn audio_type(name: &str) -> String {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".ogg") {
        "audio/ogg".into()
    } else if lower.ends_with(".mp3") {
        "audio/mpeg".into()
    } else if lower.ends_with(".wav") {
        "audio/wav".into()
    } else if lower.ends_with(".flac") {
        "audio/flac".into()
    } else if lower.ends_with(".m4a") {
        "audio/mp4".into()
    } else {
        "application/octet-stream".into()
    }
}

fn bms_order(name: &str) -> i32 {
    let lower = name.to_ascii_lowercase();
    if lower == "map2.bms" {
        0
    } else if lower == "map1.bms" {
        1
    } else if lower == "map3.bms" {
        2
    } else if lower == "map4.bms" {
        3
    } else if lower.starts_with("map") && lower.ends_with(".bms") {
        4
    } else {
        5
    }
}

fn allowed_write(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower == "info.json" || is_bms(name)
}

#[tauri::command]
fn charts_folder(folder: String) -> Result<FolderPayload, String> {
    let folder = safe_name(&folder)?;
    let dir = song_dir(&folder)?;
    let entries = fs::read_dir(&dir).map_err(|err| err.to_string())?;
    let mut charts = Vec::new();
    let mut music = Vec::new();
    for entry in entries.flatten() {
        let Ok(kind) = entry.file_type() else { continue };
        if !kind.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if is_bms(&name) {
            let text = fs::read_to_string(entry.path()).map_err(|err| err.to_string())?;
            charts.push(ChartFile { name, text });
        } else if is_audio(&name) {
            music.push(name);
        }
    }
    charts.sort_by(|a, b| bms_order(&a.name).cmp(&bms_order(&b.name)).then(a.name.cmp(&b.name)));
    music.sort();
    Ok(FolderPayload { charts, music })
}

#[tauri::command]
fn charts_read(folder: String, name: String) -> Result<ReadPayload, String> {
    let folder = safe_name(&folder)?;
    let name = safe_name(&name)?;
    let allowed = is_bms(&name) || name.eq_ignore_ascii_case("info.json") || is_audio(&name);
    if !allowed {
        return Err("File type not allowed".into());
    }
    let path = song_dir(&folder)?.join(&name);
    if is_audio(&name) {
        let bytes = fs::read(&path).map_err(|err| err.to_string())?;
        Ok(ReadPayload {
            name,
            mime: audio_type(path.file_name().and_then(|n| n.to_str()).unwrap_or("audio")),
            text: None,
            base64: Some(base64::engine::general_purpose::STANDARD.encode(bytes)),
        })
    } else {
        let text = fs::read_to_string(&path).map_err(|err| err.to_string())?;
        Ok(ReadPayload {
            mime: "text/plain".into(),
            name,
            text: Some(text),
            base64: None,
        })
    }
}

#[tauri::command]
fn charts_write(folder: String, name: String, content: String) -> Result<WritePayload, String> {
    let folder = safe_name(&folder)?;
    let name = safe_name(&name)?;
    if !allowed_write(&name) {
        return Err("File type not allowed".into());
    }
    let dir = song_dir(&folder)?;
    if !dir.is_dir() {
        return Err("Chart folder is missing".into());
    }
    let path = dir.join(&name);
    fs::write(&path, &content).map_err(|err| err.to_string())?;
    let on_disk = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    if on_disk != content {
        return Ok(WritePayload { ok: false, verified: false });
    }
    Ok(WritePayload { ok: true, verified: true })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PickedChart {
    cancelled: bool,
    name: String,
    base64: String,
}

#[tauri::command]
fn charts_pick_chart() -> Result<PickedChart, String> {
    let picked = rfd::FileDialog::new()
        .set_title("Load chart")
        .add_filter("Chart", &["bms", "bme", "bml", "mdm", "md", "zip", "json"])
        .add_filter("All files", &["*"])
        .pick_file();
    let Some(path) = picked else {
        return Ok(PickedChart { cancelled: true, name: String::new(), base64: String::new() });
    };
    let name = path.file_name().and_then(|name| name.to_str()).unwrap_or("chart").to_string();
    let bytes = fs::read(&path).map_err(|err| err.to_string())?;
    Ok(PickedChart {
        cancelled: false,
        name,
        base64: base64::engine::general_purpose::STANDARD.encode(bytes),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            charts_status,
            charts_pick_root,
            charts_pick_chart,
            charts_folder,
            charts_read,
            charts_write
        ])
        .run(tauri::generate_context!())
        .expect("error while running Stagepen");
}
