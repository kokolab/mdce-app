import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** Tauri loads index.html from the bundle. The source file stays desktop.html so the web app is untouched. */
function publishIndexHtml(): Plugin {
  return {
    name: "desktop-index-html",
    generateBundle(_options, bundle) {
      const html = bundle["desktop.html"];
      if (html && html.type === "asset") {
        bundle["index.html"] = { ...html, fileName: "index.html" };
        delete bundle["desktop.html"];
      }
    },
  };
}

/** Static shell for the Tauri desktop app. Does not start the web server. */
export default defineConfig({
  plugins: [react(), tailwindcss(), publishIndexHtml()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  base: "./",
  publicDir: "public",
  build: {
    outDir: "dist-desktop",
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./desktop.html", import.meta.url)),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
  },
});
