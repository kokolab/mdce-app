import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EditorApp } from "@/components/editor/EditorApp";
import "@/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <EditorApp />
  </StrictMode>,
);
