import { useEffect, useState } from "react";
import { CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorProvider, useEditor } from "./EditorContext";
import { IconDock } from "./panels/IconDock";
import { Inspector } from "./panels/Inspector";
import { Toolbar } from "./panels/Toolbar";
import { TopBar } from "./panels/TopBar";
import { StageArea } from "./stage/Stage";
import { useShortcuts } from "./useShortcuts";

export function Editor() {
  return (
    <EditorProvider>
      <TooltipProvider delayDuration={300}>
        <EditorLayout />
      </TooltipProvider>
    </EditorProvider>
  );
}

function EditorLayout() {
  const editor = useEditor();
  useShortcuts(editor);

  // Sur petit écran, le panneau de droite se superpose à la carte
  const [inspectorOpen, setInspectorOpen] = useState(false);
  if (editor.focusTarget && !inspectorOpen) setInspectorOpen(true);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar onToggleInspector={() => setInspectorOpen((o) => !o)} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Toolbar />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <StageArea />
          <IconDock />
        </main>
        <aside
          aria-label="Propriétés"
          className={cn(
            "flex w-76 shrink-0 flex-col overflow-y-auto border-l bg-surface",
            "max-lg:absolute max-lg:top-14 max-lg:right-0 max-lg:bottom-0 max-lg:z-30 max-lg:shadow-2xl",
            !inspectorOpen && "max-lg:hidden",
          )}
        >
          <Inspector />
        </aside>
      </div>
      <Toast />
    </div>
  );
}

function Toast() {
  const { toast, dismissToast } = useEditor();
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, toast.tone === "error" ? 6000 : 2800);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <div role="status" className="fixed top-16 left-1/2 z-50 -translate-x-1/2 px-3">
      <div
        key={toast.id}
        className={cn(
          "flex animate-pop-in items-center gap-2.5 rounded-xl py-2 pr-2 pl-4 text-sm font-medium shadow-xl",
          toast.tone === "error" ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background",
        )}
      >
        {toast.tone === "error" && <CircleAlert className="size-4 shrink-0" />}
        <span className="max-w-md">{toast.message}</span>
        <button onClick={dismissToast} className="grid size-6 place-items-center rounded-md opacity-70 hover:opacity-100" aria-label="Fermer">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
