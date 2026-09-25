import { useEffect, useRef } from "react";
import type { EditorApi } from "./EditorContext";
import { TOOLS } from "./tools";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function useShortcuts(editor: EditorApi) {
  // Toujours la dernière version de l'éditeur, sans réabonner l'écouteur à chaque rendu
  const ref = useRef(editor);
  useEffect(() => {
    ref.current = editor;
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ed = ref.current;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "s") {
        e.preventDefault();
        ed.saveProjectFile();
        return;
      }
      if (isTyping(e.target) || document.querySelector("[role=dialog]")) return;

      if (mod && key === "z" && !e.shiftKey) ed.history.undo();
      else if (mod && (key === "y" || (key === "z" && e.shiftKey))) ed.history.redo();
      else if (mod && key === "c") ed.copy();
      else if (mod && key === "v") ed.paste();
      else if (mod && key === "d") ed.duplicate();
      else if (mod && key === "a") ed.setSelectedIds(ed.doc.elements.map((el) => el.id));
      else if (e.key === "Delete" || e.key === "Backspace") ed.deleteElements(ed.selectedIds);
      else if (e.key === "Escape") {
        if (ed.tool !== "select") ed.setTool("select");
        else ed.setSelectedIds([]);
      } else if (e.key.startsWith("Arrow") && ed.selectedIds.length) {
        const step = e.shiftKey ? 2 : 0.25;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        ed.nudge(dx, dy);
      } else if (e.key === "Enter" && ed.selectedIds.length === 1) ed.requestFocus();
      else if (!mod && !e.altKey) {
        const tool = TOOLS.find((t) => t.key === e.key);
        if (!tool) return;
        ed.setTool(tool.id);
      } else return;

      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
