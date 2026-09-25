import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { useEditor } from "../EditorContext";
import { BUILTIN_ICONS, EMOJI_CHOICES } from "../model";
import { WeatherIcon } from "../WeatherIcon";

/** Palette flottante des pictos, en bas de la carte */
export function IconDock() {
  const { doc, tool, iconId, chooseIcon, removeCustomIcon } = useEditor();

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border bg-surface/95 p-1.5 shadow-lg backdrop-blur">
        {BUILTIN_ICONS.map((ic) => (
          <DockButton key={ic.id} label={ic.label} active={tool === "icon" && iconId === ic.id} onClick={() => chooseIcon(ic.id)}>
            <WeatherIcon iconId={ic.id} customIcons={[]} size={30} />
          </DockButton>
        ))}
        {doc.customIcons.length > 0 && <div className="mx-1 h-8 w-px shrink-0 bg-border" />}
        {doc.customIcons.map((ic) => (
          <div key={ic.id} className="group relative shrink-0">
            <DockButton label={ic.label} active={tool === "icon" && iconId === ic.id} onClick={() => chooseIcon(ic.id)}>
              <WeatherIcon iconId={ic.id} customIcons={doc.customIcons} size={30} />
            </DockButton>
            <button
              onClick={() => removeCustomIcon(ic.id)}
              aria-label={`Retirer ${ic.label}`}
              className="absolute -top-1 -right-1 hidden size-4 place-items-center rounded-full bg-foreground text-background group-hover:grid"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <div className="mx-1 h-8 w-px shrink-0 bg-border" />
        <CustomIconPopover />
      </div>
    </div>
  );
}

function DockButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip side="top" content={label}>
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl outline-none transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring",
          active && "bg-primary-soft ring-2 ring-primary hover:bg-primary-soft",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function CustomIconPopover() {
  const { addCustomIcon, chooseIcon } = useEditor();
  const [open, setOpen] = useState(false);
  const [glyph, setGlyph] = useState("⭐");
  const [label, setLabel] = useState("");

  function create() {
    const icon = addCustomIcon(glyph, label.trim());
    chooseIcon(icon.id);
    setOpen(false);
    setLabel("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip side="top" content="Créer un picto perso">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-xl" aria-label="Créer un picto perso">
            <Plus className="size-5!" />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent side="top" className="w-80">
        <h3 className="font-semibold">Picto perso</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Choisis un emoji et donne-lui un nom pour la légende.</p>
        <div className="mt-3 grid max-h-44 grid-cols-8 gap-0.5 overflow-y-auto rounded-lg bg-surface-2 p-1.5">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              onClick={() => setGlyph(e)}
              className={cn(
                "grid aspect-square place-items-center rounded-md text-xl outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring",
                glyph === e && "bg-surface ring-2 ring-primary",
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Input
            value={glyph}
            onChange={(e) => setGlyph(e.target.value)}
            className="w-12 px-0 text-center text-lg"
            aria-label="Emoji"
          />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom (ex. Grêle)" aria-label="Nom du picto" />
          <Button type="submit" disabled={!glyph.trim()}>
            Ajouter
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
