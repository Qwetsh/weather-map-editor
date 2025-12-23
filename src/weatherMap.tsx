import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  Download,
  Image as ImageIcon,
  Type,
  MousePointer2,
  Thermometer,
  Moon,
  Sun,
} from "lucide-react";
import { toPng } from "html-to-image";
import franceImg from "/img/france.png";
import europeImg from "/img/europe.png";
import worldImg from "/img/world.png";

/**
 * Éditeur de carte météo (React)
 * ✅ Fonds intégrés (France / Europe / Monde + grille) + upload possible
 * ✅ Ajout d'icônes (drag & drop)
 * ✅ Ajout de villes (labels)
 * ✅ Ajout de températures (badges)
 * ✅ Export PNG
 * ✅ Fix overflow: stage responsive (ne déborde plus sur le panneau de droite)
 */

const ICONS = [
  { id: "sun", label: "Soleil", glyph: "☀️" },
  { id: "cloud", label: "Nuages", glyph: "☁️" },
  { id: "rain", label: "Pluie", glyph: "🌧️" },
  { id: "storm", label: "Orage", glyph: "⛈️" },
  { id: "snow", label: "Neige", glyph: "🌨️" },
  { id: "wind", label: "Vent", glyph: "💨" },
  { id: "hot", label: "Canicule", glyph: "🔥" },
  { id: "flood", label: "Inondation", glyph: "🌊" },
  { id: "cyclone", label: "Cyclone", glyph: "🌀" },
];

// Emoji picker for custom icons
const EMOJI_PICKER = [
  "⭐", "❤️", "💚", "💙", "💜", "🌟", "✨", "💫",
  "🌈", "☔", "🌤️", "🌥️", "⛅", "🌦️", "☃️", "❄️",
  "🌡️", "🧊", "💧", "💦", "🌊", "🔥", "💨", "🌀",
  "⚡", "🌩️", "🌪️", "🌫️", "☁️", "🌬️", "🍃", "🌾",
  "🏔️", "🗻", "🏖️", "🏝️", "🌋", "⛰️", "🏕️", "🏞️",
  "🌍", "🌎", "🌏", "🌐", "🗺️", "🧭", "📍", "📌",
];

function uid(prefix = "el") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function svgDataUri(svg: string) {
  // data URI safe-ish
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

// Fonds intégrés (simplifiés) : pas d’assets externes.
const BUILTIN_BACKGROUNDS = [
  {
    id: "grid",
    label: "Grille vierge",
    src: svgDataUri(`
      <svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 1600 900'>
        <defs>
          <linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0' stop-color='#eaf2ff'/>
            <stop offset='1' stop-color='#ffffff'/>
          </linearGradient>
          <pattern id='grid' width='80' height='80' patternUnits='userSpaceOnUse'>
            <path d='M80 0H0V80' fill='none' stroke='#cbd5e1' stroke-width='1'/>
          </pattern>
        </defs>
        <rect width='1600' height='900' fill='url(#bg)'/>
        <rect width='1600' height='900' fill='url(#grid)' opacity='0.55'/>
        <text x='60' y='90' font-family='Arial' font-size='44' font-weight='700' fill='#1f2937'>Carte météo</text>
        <text x='60' y='140' font-family='Arial' font-size='22' fill='#475569'>Fond neutre pour placer villes, températures et pictos</text>
      </svg>
    `),
  },
  {
    id: "france",
    label: "France (simplifiée)",
    src: franceImg,
  },
  {
    id: "europe",
    label: "Europe (simplifiée)",
    src: europeImg,
  },
  {
    id: "world",
    label: "Monde (simplifié)",
    src: worldImg,
  },
];

type BaseElement = {
  id: string;
  kind: "icon" | "label" | "temp";
  x: number; // percent 0..100
  y: number; // percent 0..100
};

type IconElement = BaseElement & {
  kind: "icon";
  iconId: string;
  size: number; // px
};

type LabelElement = BaseElement & {
  kind: "label";
  text: string;
  fontSize: number;
  color: string;
  bg: boolean;
  border: boolean;
};

type TempElement = BaseElement & {
  kind: "temp";
  value: string; // ex: "42" ou "42 / +4"
  fontSize: number;
  color: string;
  bg: boolean;
  border: boolean;
};

type ElementT = IconElement | LabelElement | TempElement;

export default function WeatherMapEditor() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  // Ghost preview state
  const [ghost, setGhost] = useState<null | { x: number; y: number }>(null);

  // Fond: intégré par défaut
  const [bgId, setBgId] = useState(BUILTIN_BACKGROUNDS[0].id);
  const [bgUrl, setBgUrl] = useState<string | null>(BUILTIN_BACKGROUNDS[0].src);
  const [aspectRatio, setAspectRatio] = useState("16 / 9");

  const [elements, setElements] = useState<ElementT[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<null | { x0: number; y0: number; x1: number; y1: number }>(null);
  const [isDrawingSelection, setIsDrawingSelection] = useState(false);

  const [activeTool, setActiveTool] = useState<"select" | "add-icon" | "add-label" | "add-temp">("select");
  const [chosenIconId, setChosenIconId] = useState(ICONS[0].id);

  // Custom icons (session-only)
  type CustomIcon = { id: string; label: string; glyph: string };
  const [customIcons, setCustomIcons] = useState<CustomIcon[]>([]);
  const [newCustomIconGlyph, setNewCustomIconGlyph] = useState("⭐");
  const [newCustomIconLabel, setNewCustomIconLabel] = useState("Personnalisé");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [newLabelText, setNewLabelText] = useState("Paris");
  const [newTempText, setNewTempText] = useState("42");
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lastLabelFontSize, setLastLabelFontSize] = useState(() => {
    const saved = localStorage.getItem('lastLabelFontSize');
    return saved ? parseInt(saved, 10) : 20;
  });
  const [lastTempFontSize, setLastTempFontSize] = useState(() => {
    const saved = localStorage.getItem('lastTempFontSize');
    return saved ? parseInt(saved, 10) : 20;
  });

  const selected = useMemo(
    () => (selectedIds.length === 1 ? elements.find((e) => e.id === selectedIds[0]) ?? null : null),
    [elements, selectedIds]
  );

  const selectedIcon = selected?.kind === "icon" ? ICONS.find((i) => i.id === selected.iconId) : null;

  // Multi-select helpers
  function toggleSelection(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function setSelection(id: string | string[]) {
    setSelectedIds(Array.isArray(id) ? id : [id]);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function isSelected(id: string) {
    return selectedIds.includes(id);
  }

  function pointInBounds(px: number, py: number, ex: number, ey: number, size: number = 30): boolean {
    return Math.abs(px - ex) <= size && Math.abs(py - ey) <= size;
  }

  function elementsInBox(box: { x0: number; y0: number; x1: number; y1: number }): string[] {
    const minX = Math.min(box.x0, box.x1);
    const maxX = Math.max(box.x0, box.x1);
    const minY = Math.min(box.y0, box.y1);
    const maxY = Math.max(box.y0, box.y1);
    return elements
      .filter((el) => el.x >= minX && el.x <= maxX && el.y >= minY && el.y <= maxY)
      .map((el) => el.id);
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedIds.length > 0) {
        deleteSelected();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds]);

  // Theme initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('theme', newTheme);
  };

  function setBuiltinBg(id: string) {
    const bg = BUILTIN_BACKGROUNDS.find((b) => b.id === id) ?? BUILTIN_BACKGROUNDS[0];
    if (bg.id === "grid") {
      setBgId(bg.id);
      setBgUrl(bg.src);
      setAspectRatio("16 / 9");
      clearSelection();
    } else {
      // For PNG images, load to get dimensions
      const img = new Image();
      img.onload = () => {
        setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
        setBgId(bg.id);
        setBgUrl(bg.src);
        clearSelection();
      };
      img.src = bg.src;
    }
  }

  function onUploadBg(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
        setBgId("upload");
        setBgUrl(dataUrl);
        clearSelection();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function stagePointPctFromEvent(evt: React.PointerEvent) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { xPct: 0, yPct: 0 };
    const x = ((evt.clientX - rect.left) / rect.width) * 100;
    const y = ((evt.clientY - rect.top) / rect.height) * 100;
    return { xPct: clamp(x, 0, 100), yPct: clamp(y, 0, 100) };
  }

  function addIconAtPct(x: number, y: number) {
    const el: IconElement = { id: uid("icon"), kind: "icon", iconId: chosenIconId, x, y, size: 44 };
    setElements((prev) => [...prev, el]);
    setSelection(el.id);
  }

  function addLabelAtPct(x: number, y: number) {
    const el: LabelElement = {
      id: uid("label"),
      kind: "label",
      text: newLabelText.trim() || "Ville",
      x,
      y,
      fontSize: lastLabelFontSize,
      color: "#111827",
      bg: false,
      border: false,
    };
    setElements((prev) => [...prev, el]);
    setSelection(el.id);
  }

  function addTempAtPct(x: number, y: number) {
    const el: TempElement = {
      id: uid("temp"),
      kind: "temp",
      value: (newTempText.trim() || "25").replace(/\s+/g, " "),
      x,
      y,
      fontSize: lastTempFontSize,
      color: "#0f172a",
      bg: false,
      border: false,
    };
    setElements((prev) => [...prev, el]);
    setSelection(el.id);
  }

  // Drag (en %)
  const dragRef = useRef<{ ids: string[]; dx: number; dy: number } | null>(null);

  function onStagePointerDown(e: React.PointerEvent) {
    if (activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp") {
      if (!ghost) return;
      if (activeTool === "add-icon") addIconAtPct(ghost.x, ghost.y);
      else if (activeTool === "add-label") addLabelAtPct(ghost.x, ghost.y);
      else addTempAtPct(ghost.x, ghost.y);
      setGhost(null);
      
      // Shift+click for icons: keep placement mode active to place multiple icons
      if (activeTool === "add-icon" && e.shiftKey) {
        // Keep placement mode active, ghost will be recreated on next mouse move
        return;
      }
      
      setActiveTool("select");
      return;
    }
    
    // Selection box dragging
    const p = stagePointPctFromEvent(e);
    setIsDrawingSelection(true);
    setSelectionBox({ x0: p.xPct, y0: p.yPct, x1: p.xPct, y1: p.yPct });
  }

  // Mouse move for ghost preview and selection box
  function onStagePointerMove(e: React.PointerEvent) {
    if (activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp") {
      const p = stagePointPctFromEvent(e);
      setGhost({ x: p.xPct, y: p.yPct });
      return;
    }

    // Selection box drawing
    if (isDrawingSelection && selectionBox) {
      const p = stagePointPctFromEvent(e);
      setSelectionBox((prev) => prev ? { ...prev, x1: p.xPct, y1: p.yPct } : null);
    }
  }

  // Mouse leave: clear ghost
  function onStagePointerLeave() {
    setGhost(null);
    if (isDrawingSelection) {
      setIsDrawingSelection(false);
      setSelectionBox(null);
    }
  }

  // Mouse up: finalize selection box
  function onStagePointerUp(e: React.PointerEvent) {
    if (isDrawingSelection && selectionBox) {
      const selected = elementsInBox(selectionBox);
      if (selected.length > 0) {
        setSelection(selected);
      } else {
        clearSelection();
      }
      setIsDrawingSelection(false);
      setSelectionBox(null);
    }
  }

  // Right click to cancel
  function onStageContextMenu(e: React.MouseEvent) {
    if (activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp") {
      e.preventDefault();
      setGhost(null);
      setActiveTool("select");
    }
  }

  // Escape key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp") && e.key === "Escape") {
        setGhost(null);
        setActiveTool("select");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeTool]);

  function onElementPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    
    // Multi-select with Shift or Ctrl
    if (e.shiftKey || e.ctrlKey) {
      toggleSelection(id);
    } else {
      setSelection(id);
    }
    
    const p = stagePointPctFromEvent(e);
    const selectedEls = selectedIds.includes(id) ? selectedIds : [id];
    dragRef.current = { 
      ids: selectedEls, 
      dx: p.xPct - (elements.find((x) => x.id === selectedEls[0])?.x ?? 0), 
      dy: p.yPct - (elements.find((x) => x.id === selectedEls[0])?.y ?? 0) 
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onElementPointerMove(e: React.PointerEvent, id: string) {
    const d = dragRef.current;
    if (!d || !d.ids.includes(id)) return;
    e.stopPropagation();
    const p = stagePointPctFromEvent(e);
    
    // Calculate offset from first selected element
    const firstEl = elements.find((x) => x.id === d.ids[0]);
    if (!firstEl) return;
    
    const offsetX = p.xPct - d.dx - firstEl.x;
    const offsetY = p.yPct - d.dy - firstEl.y;
    
    // Move all selected elements by the same offset
    setElements((prev) =>
      prev.map((el) => {
        if (d.ids.includes(el.id)) {
          return {
            ...el,
            x: clamp(el.x + offsetX, 0, 100),
            y: clamp(el.y + offsetY, 0, 100),
          };
        }
        return el;
      })
    );
  }

  function onElementPointerUp(_e: React.PointerEvent, id: string) {
    const d = dragRef.current;
    if (d && d.ids.includes(id)) dragRef.current = null;
  }

  function deleteSelected() {
    if (selectedIds.length === 0) return;
    setElements((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
    clearSelection();
  }

  function resetAllElements() {
    if (elements.length === 0) return;
    const confirmed = window.confirm("Êtes-vous sûr de vouloir supprimer tous les éléments de la carte ? Cette action ne peut pas être annulée.");
    if (confirmed) {
      setElements([]);
      clearSelection();
    }
  }

  async function exportPng() {
    if (!stageRef.current) {
      console.error("No stage ref");
      return;
    }
    try {
      const dataUrl = await toPng(stageRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: theme === 'dark' ? "#1f2937" : "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "weather-map-2050.png";
      a.click();
    } catch (error) {
      console.error("Export failed:", error);
    }
  }

  function updateSelected(patch: Partial<ElementT>) {
    if (selectedIds.length !== 1) return;
    setElements((prev) => prev.map((e) => (e.id === selectedIds[0] ? ({ ...e, ...patch } as ElementT) : e)));
  }

  function handleLabelFontSizeChange(value: number) {
    const clamped = clamp(value, 10, 80);
    setLastLabelFontSize(clamped);
    localStorage.setItem('lastLabelFontSize', String(clamped));
    updateSelected({ fontSize: clamped } as any);
  }

  function handleTempFontSizeChange(value: number) {
    const clamped = clamp(value, 10, 80);
    setLastTempFontSize(clamped);
    localStorage.setItem('lastTempFontSize', String(clamped));
    updateSelected({ fontSize: clamped } as any);
  }

  function addCustomIcon() {
    if (!newCustomIconGlyph.trim() || !newCustomIconLabel.trim()) return;
    const customIcon: CustomIcon = {
      id: uid("custom-icon"),
      label: newCustomIconLabel.trim(),
      glyph: newCustomIconGlyph.trim(),
    };
    setCustomIcons((prev) => [...prev, customIcon]);
    // Reset form
    setNewCustomIconLabel("Personnalisé");
    setNewCustomIconGlyph("⭐");
  }

  function deleteCustomIcon(id: string) {
    setCustomIcons((prev) => prev.filter((ic) => ic.id !== id));
  }

  function getAvailableIcons() {
    return [...ICONS, ...customIcons];
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-900 p-4 md:p-6">
      <div className="mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gauche : carte */}
        <Card className="md:col-span-1 rounded-2xl shadow-sm min-w-0">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <div className="text-xl font-semibold">Éditeur de carte météo</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Fonds intégrés + icônes + villes + températures. Export en PNG.</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={toggleTheme} className="rounded-xl gap-2">
                  {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  {theme === 'light' ? 'Dark' : 'Light'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <Label className="text-sm">Fonds intégrés</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BUILTIN_BACKGROUNDS.map((b) => (
                    <Button key={b.id} variant={bgId === b.id ? "default" : "outline"} className="rounded-xl" onClick={() => setBuiltinBg(b.id)}>
                      {b.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Importer un fond (option)</Label>
                <div className="mt-2 flex gap-2 items-center">
                  <Input type="file" accept="image/*" onChange={(e) => onUploadBg(e.target.files?.[0] ?? null)} />
                  <Button variant="outline" className="rounded-xl" onClick={() => setBuiltinBg(BUILTIN_BACKGROUNDS[0].id)}>
                    Réinitialiser
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <Button className="rounded-xl gap-2" onClick={exportPng}>
                <Download className="h-4 w-4" /> Export PNG
              </Button>
              <Button variant="outline" className="rounded-xl gap-2" onClick={deleteSelected} disabled={selectedIds.length === 0}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
              <Button variant="destructive" className="rounded-xl gap-2" onClick={resetAllElements} disabled={elements.length === 0}>
                <Trash2 className="h-4 w-4" /> Réinitialiser tout
              </Button>
            </div>

            {/* STAGE RESPONSIVE : plus de width fixe => plus de débordement */}
            <div className="rounded-2xl border bg-white dark:bg-slate-800 p-3 min-w-0">
              <div
                ref={stageRef}
                onPointerDown={onStagePointerDown}
                onPointerMove={onStagePointerMove}
                onPointerLeave={onStagePointerLeave}
                onPointerUp={onStagePointerUp}
                onContextMenu={onStageContextMenu}
                className="relative w-full overflow-hidden rounded-xl border bg-slate-100 dark:bg-slate-700"
                style={{ aspectRatio }}
              >
                {bgUrl ? (
                  <img src={bgUrl} alt="Fond de carte" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
                ) : null}

                {elements.map((el) => {
                  const isSelItem = isSelected(el.id);
                  const baseClass = "absolute select-none cursor-move" + (isSelItem ? " border-2 border-dashed border-indigo-500 rounded-lg" : "");

                  if (el.kind === "icon") {
                    const icon = getAvailableIcons().find((i) => i.id === el.iconId) ?? ICONS[0];
                    return (
                      <div
                        key={el.id}
                        onPointerDown={(e) => onElementPointerDown(e, el.id)}
                        onPointerMove={(e) => onElementPointerMove(e, el.id)}
                        onPointerUp={(e) => onElementPointerUp(e, el.id)}
                        className={baseClass}
                        style={{ left: `${el.x}%`, top: `${el.y}%`, transform: "translate(-50%, -50%)", fontSize: el.size, padding: 4 }}
                        title={icon.label}
                      >
                        <span aria-label={icon.label}>{icon.glyph}</span>
                      </div>
                    );
                  }

                  if (el.kind === "temp") {
                    return (
                      <div
                        key={el.id}
                        onPointerDown={(e) => onElementPointerDown(e, el.id)}
                        onPointerMove={(e) => onElementPointerMove(e, el.id)}
                        onPointerUp={(e) => onElementPointerUp(e, el.id)}
                        className={baseClass}
                        style={{ left: `${el.x}%`, top: `${el.y}%`, transform: "translate(-50%, -50%)" }}
                        title="Température"
                      >
                        <div
                          className={"px-2 py-1 rounded-xl " + (el.bg ? "bg-white/90" : "bg-transparent") + (el.border ? " border shadow-sm" : "")}
                          style={{ color: el.color, fontSize: el.fontSize, fontWeight: 800, cursor: 'move' }}
                        >
                          {String(el.value).includes("°") ? el.value : `${el.value}°C`}
                        </div>
                      </div>
                    );
                  }

                  // label
                  return (
                    <div
                      key={el.id}
                      onPointerDown={(e) => onElementPointerDown(e, el.id)}
                      onPointerMove={(e) => onElementPointerMove(e, el.id)}
                      onPointerUp={(e) => onElementPointerUp(e, el.id)}
                      className={baseClass}
                      style={{ left: `${el.x}%`, top: `${el.y}%`, transform: "translate(-50%, -50%)" }}
                      title="Ville"
                    >
                      <div className={"px-2 py-1 rounded-lg " + (el.bg ? "bg-white/85 backdrop-blur" : "") + (el.border ? " border shadow-sm" : "")} style={{ color: el.color, fontSize: el.fontSize, fontWeight: 700, cursor: 'move' }}>
                        {el.text}
                      </div>
                    </div>
                  );
                })}

                {/* Ghost preview */}
                {ghost && (activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp") && (
                  <>
                    {activeTool === "add-icon" && (
                      <div
                        className="absolute pointer-events-none opacity-60 select-none"
                        style={{ left: `${ghost.x}%`, top: `${ghost.y}%`, transform: "translate(-50%, -50%)", fontSize: 44, padding: 4 }}
                      >
                        <span>{getAvailableIcons().find((i) => i.id === chosenIconId)?.glyph ?? "?"}</span>
                      </div>
                    )}
                    {activeTool === "add-label" && (
                      <div
                        className="absolute pointer-events-none opacity-60 select-none"
                        style={{ left: `${ghost.x}%`, top: `${ghost.y}%`, transform: "translate(-50%, -50%)" }}
                      >
                        <div className="px-2 py-1 rounded-lg bg-white/85 backdrop-blur border shadow-sm" style={{ color: "#111827", fontSize: 20, fontWeight: 700 }}>
                          {newLabelText.trim() || "Ville"}
                        </div>
                      </div>
                    )}
                    {activeTool === "add-temp" && (
                      <div
                        className="absolute pointer-events-none opacity-60 select-none"
                        style={{ left: `${ghost.x}%`, top: `${ghost.y}%`, transform: "translate(-50%, -50%)" }}
                      >
                        <div className="px-2 py-1 rounded-xl bg-white/90 border shadow-sm" style={{ color: "#0f172a", fontSize: 20, fontWeight: 800 }}>
                          {(newTempText.trim() || "25").includes("°") ? newTempText.trim() || "25" : `${newTempText.trim() || "25"}°C`}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Selection box */}
                {selectionBox && isDrawingSelection && (
                  <div
                    className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
                    style={{
                      left: `${Math.min(selectionBox.x0, selectionBox.x1)}%`,
                      top: `${Math.min(selectionBox.y0, selectionBox.y1)}%`,
                      width: `${Math.abs(selectionBox.x1 - selectionBox.x0)}%`,
                      height: `${Math.abs(selectionBox.y1 - selectionBox.y0)}%`,
                    }}
                  />
                )}
              </div>

              <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 cursor-default">
                <span className="font-semibold">Astuce :</span> clique sur « Icône / Ville / Température », puis clique sur la carte. Déplace en glissant. Clique sur un élément pour l'éditer. Glisse pour sélectionner plusieurs éléments. Shift+clic sur les icônes pour en placer plusieurs d'affilée.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Droite : panneau */}
        <Card className="rounded-2xl shadow-sm min-w-0">
          <CardContent className="p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <Button variant={activeTool === "select" ? "default" : "outline"} onClick={() => setActiveTool("select")} className="rounded-xl gap-2">
                <MousePointer2 className="h-4 w-4" /> Sélection
              </Button>
              <Button variant={activeTool === "add-icon" ? "default" : "outline"} onClick={() => setActiveTool("add-icon")} className="rounded-xl gap-2">
                <ImageIcon className="h-4 w-4" /> Icône
              </Button>
              <Button variant={activeTool === "add-label" ? "default" : "outline"} onClick={() => setActiveTool("add-label")} className="rounded-xl gap-2">
                <Type className="h-4 w-4" /> Ville
              </Button>
              <Button variant={activeTool === "add-temp" ? "default" : "outline"} onClick={() => setActiveTool("add-temp")} className="rounded-xl gap-2">
                <Thermometer className="h-4 w-4" /> Température
              </Button>
            </div>

            <div className="text-lg font-semibold">Panneau de contrôle</div>
            <div className="text-sm text-slate-600 dark:text-slate-300 cursor-default">Choisis ce que tu veux ajouter, puis clique sur la carte.</div>

            <Separator />

            <div className="space-y-3">
              <div className="font-semibold text-sm">Ajouter une icône</div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto overflow-x-hidden pr-1">
                {getAvailableIcons().map((ic) => (
                  <div key={ic.id} className="relative">
                    <Button
                      variant={chosenIconId === ic.id ? "default" : "outline"}
                      className="justify-start rounded-xl gap-2 w-full"
                      onClick={() => {
                        setChosenIconId(ic.id);
                        setActiveTool("add-icon");
                      }}
                    >
                      <span className="text-lg">{ic.glyph}</span>
                      <span className="text-xs flex-1 text-left truncate">{ic.label}</span>
                    </Button>
                    {customIcons.find((ci) => ci.id === ic.id) && (
                      <button
                        onClick={() => deleteCustomIcon(ic.id)}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                        title="Supprimer l'icône"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-semibold">Créer une icône personnalisée</Label>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Choisir un emoji</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="h-6 px-2 text-xs"
                    >
                      {showEmojiPicker ? 'Masquer' : 'Afficher'} 😊
                    </Button>
                  </div>
                  {showEmojiPicker && (
                    <div className="grid grid-cols-8 gap-1 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg max-h-32 overflow-y-auto">
                      {EMOJI_PICKER.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNewCustomIconGlyph(emoji)}
                          className={`text-xl p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors ${
                            newCustomIconGlyph === emoji ? 'bg-slate-300 dark:bg-slate-500 ring-2 ring-blue-500' : ''
                          }`}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Emoji ou caractère"
                    value={newCustomIconGlyph}
                    onChange={(e) => setNewCustomIconGlyph(e.target.value)}
                    maxLength={2}
                    className="w-16 text-center text-xl"
                  />
                  <Input
                    type="text"
                    placeholder="Nom"
                    value={newCustomIconLabel}
                    onChange={(e) => setNewCustomIconLabel(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <Button className="w-full rounded-xl text-xs" onClick={addCustomIcon}>
                  + Ajouter
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="font-semibold text-sm">Ajouter une ville</div>
              <div className="space-y-2">
                <Label className="text-xs">Nom de la ville</Label>
                <Input value={newLabelText} onChange={(e) => setNewLabelText(e.target.value)} placeholder="Ex: Nantes" />
                <Button className="rounded-xl" onClick={() => setActiveTool("add-label")}>Placer la ville</Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="font-semibold text-sm">Ajouter une température</div>
              <div className="space-y-2">
                <Label className="text-xs">Valeur (ex : 42 ou 42 / +4)</Label>
                <Input value={newTempText} onChange={(e) => setNewTempText(e.target.value)} placeholder="Ex: 42 / +4" />
                <Button className="rounded-xl" onClick={() => setActiveTool("add-temp")}>Placer la température</Button>
                <div className="text-xs text-slate-600 dark:text-slate-300 cursor-default">Astuce : « 42 / +4 » = 42°C et anomalie +4°C.</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="font-semibold text-sm">Éditer la sélection</div>
              {selectedIds.length === 0 ? (
                <div className="text-sm text-slate-500 cursor-default">Aucun élément sélectionné.</div>
              ) : selectedIds.length > 1 ? (
                <div className="text-sm text-slate-700 cursor-default">
                  <span className="font-semibold">{selectedIds.length} éléments sélectionnés</span>
                  <div className="mt-2 text-xs text-slate-600">Glisse pour déplacer le groupe ensemble, ou clique pour sélectionner un seul élément.</div>
                </div>
              ) : selected?.kind === "icon" ? (
                <div className="space-y-3">
                  <div className="text-sm text-slate-700 cursor-default">
                    Sélection : <span className="font-semibold">{selectedIcon?.label ?? "Icône"}</span>
                  </div>
                  <Label className="text-xs">Taille</Label>
                  <Input type="range" min={24} max={80} value={selected.size} onChange={(e) => updateSelected({ size: Number(e.target.value) } as any)} />
                </div>
              ) : selected?.kind === "label" ? (
                <div className="space-y-3">
                  <Label className="text-xs">Texte</Label>
                  <Input value={selected.text} onChange={(e) => updateSelected({ text: e.target.value } as any)} />
                  <div>
                    <Label className="text-xs">Taille du texte (px)</Label>
                    <div className="mt-2 flex gap-2 items-center">
                      <Input type="number" min={10} max={80} value={selected.fontSize} onChange={(e) => handleLabelFontSizeChange(Number(e.target.value))} className="w-20" />
                      <Input type="range" min={10} max={80} value={selected.fontSize} onChange={(e) => handleLabelFontSizeChange(Number(e.target.value))} className="flex-1" />
                    </div>
                  </div>
                  <Label className="text-xs">Couleur</Label>
                  <Input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value } as any)} />
                  <div className="flex items-center gap-2">
                    <input id="bg" type="checkbox" checked={selected.bg} onChange={(e) => updateSelected({ bg: e.target.checked } as any)} />
                    <Label htmlFor="bg" className="text-sm">Fond blanc derrière</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="border" type="checkbox" checked={selected.border} onChange={(e) => updateSelected({ border: e.target.checked } as any)} />
                    <Label htmlFor="border" className="text-sm">Bordure</Label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label className="text-xs">Température</Label>
                  <Input value={selected.value} onChange={(e) => updateSelected({ value: e.target.value } as any)} />
                  <div>
                    <Label className="text-xs">Taille (px)</Label>
                    <div className="mt-2 flex gap-2 items-center">
                      <Input type="number" min={10} max={80} value={selected.fontSize} onChange={(e) => handleTempFontSizeChange(Number(e.target.value))} className="w-20" />
                      <Input type="range" min={10} max={80} value={selected.fontSize} onChange={(e) => handleTempFontSizeChange(Number(e.target.value))} className="flex-1" />
                    </div>
                  </div>
                  <Label className="text-xs">Couleur</Label>
                  <Input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value } as any)} />
                  <div className="flex items-center gap-2">
                    <input id="tbg" type="checkbox" checked={selected.bg} onChange={(e) => updateSelected({ bg: e.target.checked } as any)} />
                    <Label htmlFor="tbg" className="text-sm">Fond blanc derrière</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="tborder" type="checkbox" checked={selected.border} onChange={(e) => updateSelected({ border: e.target.checked } as any)} />
                    <Label htmlFor="tborder" className="text-sm">Bordure</Label>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
