import { useRef, useState } from "react";
import { ChevronDown, FilePlus2, FolderOpen, ImageDown, LoaderCircle, Moon, PanelRight, Redo2, Save, Sun, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { useEditor } from "../EditorContext";
import { WeatherIcon } from "../WeatherIcon";

export function TopBar({ onToggleInspector }: { onToggleInspector: () => void }) {
  const editor = useEditor();
  const { history } = editor;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-surface px-3">
      <div className="flex items-center gap-2.5 pr-2">
        <span className="grid size-9 place-items-center rounded-xl bg-primary-soft">
          <WeatherIcon iconId="partly" customIcons={[]} size={26} />
        </span>
        <div className="hidden leading-tight sm:block">
          <h1 className="text-[15px] font-semibold">Carte météo</h1>
          <p className="text-xs text-muted-foreground">Éditeur pour la classe</p>
        </div>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

      <Tooltip content={<>Annuler <Kbd>Ctrl Z</Kbd></>}>
        <Button variant="ghost" size="icon" onClick={history.undo} disabled={!history.canUndo} aria-label="Annuler">
          <Undo2 />
        </Button>
      </Tooltip>
      <Tooltip content={<>Rétablir <Kbd>Ctrl Y</Kbd></>}>
        <Button variant="ghost" size="icon" onClick={history.redo} disabled={!history.canRedo} aria-label="Rétablir">
          <Redo2 />
        </Button>
      </Tooltip>

      <div className="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            Projet <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem icon={<FilePlus2 />} onSelect={() => setConfirmNew(true)}>
            Nouvelle carte
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<FolderOpen />} onSelect={() => fileRef.current?.click()}>
            Ouvrir un projet…
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Save />} onSelect={editor.saveProjectFile} shortcut="Ctrl+S">
            Enregistrer le projet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) editor.openProjectFile(file);
          e.target.value = "";
        }}
      />

      <Tooltip content={editor.theme === "light" ? "Mode sombre" : "Mode clair"}>
        <Button variant="ghost" size="icon" onClick={editor.toggleTheme} aria-label="Changer de thème">
          {editor.theme === "light" ? <Moon /> : <Sun />}
        </Button>
      </Tooltip>

      <Tooltip content="Panneau de propriétés">
        <Button variant="ghost" size="icon" onClick={onToggleInspector} className="lg:hidden" aria-label="Panneau de propriétés">
          <PanelRight />
        </Button>
      </Tooltip>

      <Button onClick={editor.exportPng} disabled={editor.exporting} className="ml-1">
        {editor.exporting ? <LoaderCircle className="animate-spin" /> : <ImageDown />}
        <span className="hidden sm:inline">Exporter l'image</span>
      </Button>

      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">Commencer une nouvelle carte ?</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Tous les éléments posés sur la carte seront effacés. Le fond de carte est conservé. Tu pourras revenir en arrière avec{" "}
            <Kbd className="opacity-100">Ctrl Z</Kbd>.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Annuler</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                editor.newMap();
                setConfirmNew(false);
              }}
            >
              Effacer la carte
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
