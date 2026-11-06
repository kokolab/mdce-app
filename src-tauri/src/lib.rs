use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use serde::Serialize;

#[derive(Serialize)]
struct ChartsStatus {
    enabled: bool,
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

fn charts_root() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_else(|_| PathBuf::from("."));
    let dir = exe.parent().unwrap_or_else(|| Path::new("."));
    dir.join("Custom_Albums")
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
fn charts_status() -> ChartsStatus {
    let root = charts_root();
    let _ = fs::create_dir_all(&root);
    let mut folders = Vec::new();
    if let Ok(entries) = fs::read_dir(&root) {
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
    folders.sort();
    ChartsStatus {
        enabled: true,
        folders,
        root: root.display().to_string(),
    }
}

#[tauri::command]
fn charts_folder(folder: String) -> Result<FolderPayload, String> {
    let folder = safe_name(&folder)?;
    let dir = charts_root().join(&folder);
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
    let path = charts_root().join(&folder).join(&name);
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
    let dir = charts_root().join(&folder);
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let path = dir.join(&name);
    fs::write(&path, &content).map_err(|err| err.to_string())?;
    let on_disk = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    if on_disk != content {
        return Ok(WritePayload { ok: false, verified: false });
    }
    Ok(WritePayload { ok: true, verified: true })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            charts_status,
            charts_folder,
            charts_read,
            charts_write
        ])
        .run(tauri::generate_context!())
        .expect("error while running Stagepen");
}
