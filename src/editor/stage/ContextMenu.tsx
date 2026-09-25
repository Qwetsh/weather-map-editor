import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Lock,
  LockOpen,
  MapPin,
  MousePointerSquareDashed,
  Pencil,
  Thermometer,
  Trash2,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  menuItemClass,
  menuItemDestructiveClass,
  menuItemSelectedClass,
  menuLabelClass,
  menuPanelClass,
  menuSeparatorClass,
} from "@/components/ui/menu-styles";
import { useEditor } from "../EditorContext";
import { isTextElement } from "../model";
import { WeatherIcon } from "../WeatherIcon";
import { PressureDot } from "../PressureDot";

export type ContextMenuState = {
  clientX: number;
  clientY: number;
  /** Position sur la carte, en % */
  at: { x: number; y: number };
  targetIds: string[];
};

export function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const editor = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.clientX, top: menu.clientY });

  // Garde le menu dans la fenêtre
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.min(menu.clientX, window.innerWidth - width - 8),
      top: Math.min(menu.clientY, window.innerHeight - height - 8),
    });
  }, [menu.clientX, menu.clientY]);

  useLayoutEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const targets = editor.doc.elements.filter((e) => menu.targetIds.includes(e.id));
  const ids = targets.map((t) => t.id);
  const anyLocked = targets.some((t) => t.locked);
  const allPressure = targets.length > 0 && targets.every((t) => t.kind === "pressure");
  const canPaste = editor.clipboard.length > 0;

  return (
    <div
      ref={ref}
      role="menu"
      className={cn("fixed z-50", menuPanelClass)}
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      {targets.length > 0 ? (
        <>
          {targets.length === 1 && isTextElement(targets[0]) && (
            <Item icon={<Pencil />} onClick={act(() => editor.requestFocus(ids[0]))} shortcut="Double-clic">
              Modifier
            </Item>
          )}
          <Item icon={<Copy />} onClick={act(() => editor.copy(ids))} shortcut="Ctrl+C">
            Copier
          </Item>
          <Item icon={<CopyPlus />} onClick={act(() => editor.duplicate(ids))} shortcut="Ctrl+D">
            Dupliquer
          </Item>
          {canPaste && (
            <Item icon={<ClipboardPaste />} onClick={act(() => editor.paste(menu.at))}>
              Coller ici
            </Item>
          )}
          <Separator />
          <Item icon={<ArrowUpToLine />} onClick={act(() => editor.reorder(ids, "front"))}>
            Mettre au premier plan
          </Item>
          <Item icon={<ArrowDownToLine />} onClick={act(() => editor.reorder(ids, "back"))}>
            Mettre à l'arrière-plan
          </Item>
          <Item icon={anyLocked ? <LockOpen /> : <Lock />} onClick={act(() => editor.setLocked(ids, !anyLocked))}>
            {anyLocked ? "Déverrouiller" : "Verrouiller"}
          </Item>
          {allPressure && (
            <>
              <Separator />
              <div className={menuLabelClass}>Hémisphère</div>
              {(["North", "South"] as const).map((h) => (
                <Item
                  key={h}
                  selected={targets.every((t) => t.kind === "pressure" && (t.hemisphere ?? "North") === h)}
                  onClick={act(() => editor.updateElements(ids, { hemisphere: h }))}
                >
                  {h === "North" ? "Nord" : "Sud"}
                </Item>
              ))}
            </>
          )}
          <Separator />
          <Item icon={<Trash2 />} destructive onClick={act(() => editor.deleteElements(ids))} shortcut="Suppr">
            Supprimer{targets.length > 1 ? ` (${targets.length})` : ""}
          </Item>
        </>
      ) : (
        <>
          <div className={menuLabelClass}>Ajouter ici</div>
          <Item
            icon={<WeatherIcon iconId={editor.iconId} customIcons={editor.doc.customIcons} size={16} />}
            onClick={act(() => editor.addElementAt("icon", menu.at.x, menu.at.y))}
          >
            Picto météo
          </Item>
          <Item icon={<MapPin />} onClick={act(() => editor.addElementAt("label", menu.at.x, menu.at.y))}>
            Nom de ville
          </Item>
          <Item icon={<Thermometer />} onClick={act(() => editor.addElementAt("temp", menu.at.x, menu.at.y))}>
            Température
          </Item>
          <Item icon={<Wind />} onClick={act(() => editor.addElementAt("wind", menu.at.x, menu.at.y))}>
            Force du vent
          </Item>
          <Item icon={<PressureDot zone="A" />} onClick={act(() => editor.addPressure("anticyclone", menu.at.x, menu.at.y, 6))}>
            Anticyclone
          </Item>
          <Item icon={<PressureDot zone="D" />} onClick={act(() => editor.addPressure("depression", menu.at.x, menu.at.y, 6))}>
            Dépression
          </Item>
          <Separator />
          {canPaste && (
            <Item icon={<ClipboardPaste />} onClick={act(() => editor.paste(menu.at))} shortcut="Ctrl+V">
              Coller ici
            </Item>
          )}
          <Item
            icon={<MousePointerSquareDashed />}
            onClick={act(() => editor.setSelectedIds(editor.doc.elements.map((e) => e.id)))}
            shortcut="Ctrl+A"
          >
            Tout sélectionner
          </Item>
        </>
      )}
    </div>
  );
}

function Item({
  icon,
  shortcut,
  destructive,
  selected,
  onClick,
  children,
}: {
  icon?: ReactNode;
  shortcut?: string;
  destructive?: boolean;
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      role="menuitem"
      className={cn(menuItemClass, destructive && menuItemDestructiveClass, selected && menuItemSelectedClass)}
      onClick={onClick}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
    </button>
  );
}

function Separator() {
  return <div className={menuSeparatorClass} />;
}
