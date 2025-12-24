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
  Wind,
  Lock,
  Unlock,
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
  locked?: boolean;
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

type WindElement = BaseElement & {
  kind: "wind";
  speedKmh: number; // vitesse en km/h
  fontSize: number;
  color: string;
  bg: boolean;
  border: boolean;
};

type PressureZoneElement = BaseElement & {
  kind: "pressure";
  zone: "anticyclone" | "depression";
  radius: number; // percent of stage width
  hemisphere: "North" | "South"; // rotation direction depends on hemisphere
};

type ElementT = IconElement | LabelElement | TempElement | WindElement | PressureZoneElement;

// Project save/load types and utilities
type ProjectData = {
  version: number;
  timestamp: number;
  bgId: string;
  bgUrl: string | null;
  aspectRatio: string;
  elements: ElementT[];
  customIcons: Array<{ id: string; label: string; glyph: string }>;
};

const STORAGE_KEY = "weathermap_project";
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

function saveProjectToLocalStorage(data: ProjectData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save project to localStorage:", e);
  }
}

function loadProjectFromLocalStorage(): ProjectData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.error("Failed to load project from localStorage:", e);
    return null;
  }
}

function exportProjectAsJson(data: ProjectData): string {
  return JSON.stringify(data, null, 2);
}

function downloadJsonFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importProjectFromJson(jsonString: string): ProjectData | null {
  try {
    const data = JSON.parse(jsonString);
    // Validate structure
    if (!data.version || !data.elements || !Array.isArray(data.elements)) {
      throw new Error("Invalid project format");
    }
    return data as ProjectData;
  } catch (e) {
    console.error("Failed to parse project JSON:", e);
    alert("Erreur : Fichier de projet invalide. Vérifiez le format JSON.");
    return null;
  }
}

/**
 * Custom hook for managing undo history
 * Keeps a stack of states and allows reverting to previous states
 */
function useHistory<T>(initialState: T, maxHistorySize: number = 50) {
  const [state, setState] = useState<T>(initialState);
  const historyRef = useRef<T[]>([initialState]);
  const historyIndexRef = useRef<number>(0);

  // Commit a new state and record it in history
  const updateState = (newState: T | ((prev: T) => T)) => {
    setState((prev) => {
      const nextState = typeof newState === 'function' ? (newState as (prev: T) => T)(prev) : newState;
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(nextState);
      if (historyRef.current.length > maxHistorySize) {
        historyRef.current.shift();
      } else {
        historyIndexRef.current++;
      }
      return nextState;
    });
  };

  // Update state without recording history (useful for interactive drags)
  const setStateWithoutHistory = (newState: T | ((prev: T) => T)) => {
    setState((prev) => (typeof newState === 'function' ? (newState as (prev: T) => T)(prev) : newState));
  };

  // Commit current state to history (after a series of temporary updates)
  const commit = () => {
    setState((prev) => {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(prev);
      if (historyRef.current.length > maxHistorySize) {
        historyRef.current.shift();
      } else {
        historyIndexRef.current++;
      }
      return prev;
    });
  };

  const undo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const previousState = historyRef.current[historyIndexRef.current];
      setState(previousState);
    }
  };

  return { state, setState: updateState, setStateWithoutHistory, commit, undo };
}

export default function WeatherMapEditor() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Ghost preview state
  const [ghost, setGhost] = useState<null | { x: number; y: number }>(null);

  // Initialize from localStorage or defaults
  const [bgId, setBgId] = useState(() => {
    const saved = loadProjectFromLocalStorage();
    return saved?.bgId ?? BUILTIN_BACKGROUNDS[0].id;
  });
  const [bgUrl, setBgUrl] = useState<string | null>(() => {
    const saved = loadProjectFromLocalStorage();
    return saved?.bgUrl ?? BUILTIN_BACKGROUNDS[0].src;
  });
  const [aspectRatio, setAspectRatio] = useState(() => {
    const saved = loadProjectFromLocalStorage();
    return saved?.aspectRatio ?? "16 / 9";
  });

  // Initialize elements from localStorage
  const initialElements = (() => {
    const saved = loadProjectFromLocalStorage();
    return saved?.elements ?? [];
  })();
  const { state: elements, setState: setElements, setStateWithoutHistory: setElementsTemp, commit: commitElements, undo: undoElements } = useHistory<ElementT[]>(initialElements, 50);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<null | { x0: number; y0: number; x1: number; y1: number }>(null);
  const [isDrawingSelection, setIsDrawingSelection] = useState(false);
  const [clipboard, setClipboard] = useState<ElementT[]>([]);
  const [contextMenu, setContextMenu] = useState<null | {
    x: number; // screen coordinates
    y: number;
    target: 'stage' | 'item';
    targetIds: string[];
    stageX: number; // stage percent coordinates
    stageY: number;
  }>(null);
  const [editModal, setEditModal] = useState<null | { elementId: string }>(null);
  const [drawingZone, setDrawingZone] = useState<null | { kind: 'anticyclone' | 'depression'; cx: number; cy: number; r: number }>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  const [activeTool, setActiveTool] = useState<
    | "select"
    | "add-icon"
    | "add-label"
    | "add-temp"
    | "add-wind"
    | "add-anticyclone"
    | "add-depression"
  >("select");
  const [chosenIconId, setChosenIconId] = useState(ICONS[0].id);

  // Custom icons
  type CustomIcon = { id: string; label: string; glyph: string };
  const [customIcons, setCustomIcons] = useState<CustomIcon[]>(() => {
    const saved = loadProjectFromLocalStorage();
    return saved?.customIcons ?? [];
  });
  const [newCustomIconGlyph, setNewCustomIconGlyph] = useState("⭐");
  const [newCustomIconLabel, setNewCustomIconLabel] = useState("Personnalisé");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Removed quick-input defaults; new items will open edit modal
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lastLabelFontSize, setLastLabelFontSize] = useState(() => {
    const saved = localStorage.getItem('lastLabelFontSize');
    return saved ? parseInt(saved, 10) : 20;
  });
  const [lastTempFontSize, setLastTempFontSize] = useState(() => {
    const saved = localStorage.getItem('lastTempFontSize');
    return saved ? parseInt(saved, 10) : 20;
  });
  const [lastWindFontSize, setLastWindFontSize] = useState(() => {
    const saved = localStorage.getItem('lastWindFontSize');
    return saved ? parseInt(saved, 10) : 20;
  });

  // Legend state
  const [showLegend, setShowLegend] = useState(true);
  const [legendPosition, setLegendPosition] = useState<{ x: number; y: number }>({ x: 2, y: 2 }); // percent
  const legendDragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  const selected = useMemo(
    () => (selectedIds.length === 1 ? elements.find((e) => e.id === selectedIds[0]) ?? null : null),
    [elements, selectedIds]
  );

  const selectedIcon = selected?.kind === "icon" ? ICONS.find((i) => i.id === selected.iconId) : null;

  const selectedLockedCount = useMemo(() => {
    return selectedIds.filter((id) => elements.find((e) => e.id === id)?.locked).length;
  }, [elements, selectedIds]);

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

  // Generate legend entries based on current elements
  type LegendEntry = {
    kind: 'icon' | 'pressure' | 'temp' | 'wind';
    iconId?: string;
    label: string;
    glyph: string;
  };

  function generateLegend(): LegendEntry[] {
    const legendMap = new Map<string, LegendEntry>();

    elements.forEach((el) => {
      if (el.kind === 'icon') {
        const icon = getAvailableIcons().find((i) => i.id === el.iconId);
        if (icon) {
          const key = `icon-${el.iconId}`;
          if (!legendMap.has(key)) {
            legendMap.set(key, {
              kind: 'icon',
              iconId: el.iconId,
              label: icon.label,
              glyph: icon.glyph,
            });
          }
        }
      } else if (el.kind === 'pressure') {
        // Only show in legend if circle is small (radius < 8) - when it displays A or D
        if (el.radius < 8) {
          const key = `pressure-${el.zone}`;
          const glyph = el.zone === 'anticyclone' ? 'A' : 'D';
          const label = el.zone === 'anticyclone' ? 'Anticyclone' : 'Dépression';
          if (!legendMap.has(key)) {
            legendMap.set(key, {
              kind: 'pressure',
              label,
              glyph,
            });
          }
        }
      } else if (el.kind === 'wind') {
        const key = 'wind';
        if (!legendMap.has(key)) {
          legendMap.set(key, {
            kind: 'wind',
            label: 'Vent',
            glyph: '💨',
          });
        }
      }
    });

    return Array.from(legendMap.values()).sort((a, b) => {
      // Sort by kind priority
      const kindOrder = { icon: 0, pressure: 1, wind: 2 };
      return kindOrder[a.kind] - kindOrder[b.kind];
    });
  }

  // Auto-save to localStorage
  useEffect(() => {
    const interval = setInterval(() => {
      const projectData: ProjectData = {
        version: 1,
        timestamp: Date.now(),
        bgId,
        bgUrl,
        aspectRatio,
        elements,
        customIcons,
      };
      saveProjectToLocalStorage(projectData);
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [bgId, bgUrl, aspectRatio, elements, customIcons]);

  // Export project as JSON
  function exportProject() {
    const projectData: ProjectData = {
      version: 1,
      timestamp: Date.now(),
      bgId,
      bgUrl,
      aspectRatio,
      elements,
      customIcons,
    };
    const json = exportProjectAsJson(projectData);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadJsonFile(json, `weather-map-${timestamp}.json`);
  }

  // Import project from JSON
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const imported = importProjectFromJson(content);
      if (!imported) return;

      // Restore project state
      setBgId(imported.bgId);
      setBgUrl(imported.bgUrl);
      setAspectRatio(imported.aspectRatio);
      setElements(imported.elements);
      setCustomIcons(imported.customIcons);
      setSelectedIds([]);
      setClipboard([]);
      
      alert("Projet importé avec succès !");
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field - if so, don't interfere
      const target = e.target as HTMLElement;
      const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      // Undo: Ctrl+Z or Cmd+Z (works even in input fields for consistency with browser behavior)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isInInput) {
        e.preventDefault();
        undoElements();
        return;
      }
      
      // Close modals on Escape
      if (e.key === 'Escape') {
        if (editModal) {
          setEditModal(null);
          return;
        }
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
      }
      
      if (e.key === 'Delete' && selectedIds.length > 0 && !isInInput) {
        deleteSelected();
      }
      
      // Copy: Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedIds.length > 0 && !isInInput) {
        e.preventDefault();
        copySelected();
      }
      
      // Paste: Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard.length > 0 && !isInInput) {
        e.preventDefault();
        pasteFromClipboard();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, clipboard, contextMenu, editModal, undoElements]);

  function copySelected() {
    if (selectedIds.length === 0) return;
    const itemsToCopy = elements.filter((el) => selectedIds.includes(el.id));
    setClipboard(itemsToCopy);
  }

  function pasteFromClipboard(atX?: number, atY?: number) {
    if (clipboard.length === 0) return;
    
    // If position specified, paste relative to that position
    // Otherwise use default offset from original position
    const PASTE_OFFSET = 5; // 5% offset
    
    let newElements: ElementT[];
    if (atX !== undefined && atY !== undefined) {
      // Paste at specific position (e.g., from context menu)
      // Calculate centroid of copied items
      const avgX = clipboard.reduce((sum, el) => sum + el.x, 0) / clipboard.length;
      const avgY = clipboard.reduce((sum, el) => sum + el.y, 0) / clipboard.length;
      
      newElements = clipboard.map((el) => {
        const offsetX = el.x - avgX;
        const offsetY = el.y - avgY;
        return {
          ...el,
          id: uid(el.kind),
          x: clamp(atX + offsetX, 0, 100),
          y: clamp(atY + offsetY, 0, 100),
        } as ElementT;
      });
    } else {
      // Default paste with offset
      newElements = clipboard.map((el) => {
        const newEl = {
          ...el,
          id: uid(el.kind),
          x: clamp(el.x + PASTE_OFFSET, 0, 100),
          y: clamp(el.y + PASTE_OFFSET, 0, 100),
        };
        return newEl as ElementT;
      });
    }
    
    // Add new elements to the stage
    setElements((prev) => [...prev, ...newElements]);
    
    // Select the pasted items
    setSelection(newElements.map((el) => el.id));
  }

  function duplicateSelected() {
    if (selectedIds.length === 0) return;
    const itemsToDuplicate = elements.filter((el) => selectedIds.includes(el.id));
    
    const DUPLICATE_OFFSET = 5; // 5% offset
    const newElements: ElementT[] = itemsToDuplicate.map((el) => {
      return {
        ...el,
        id: uid(el.kind),
        x: clamp(el.x + DUPLICATE_OFFSET, 0, 100),
        y: clamp(el.y + DUPLICATE_OFFSET, 0, 100),
      } as ElementT;
    });
    
    setElements((prev) => [...prev, ...newElements]);
    setSelection(newElements.map((el) => el.id));
  }

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

  // Track stage size for accurate circle rendering
  useEffect(() => {
    const update = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect) setStageSize({ w: rect.width, h: rect.height });
    };
    update();
    if (!stageRef.current) return;
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(update);
      ro.observe(stageRef.current);
    } catch {}
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, []);

  // Pause animations when tab is hidden
  useEffect(() => {
    const onVisibilityChange = () => {
      setAnimationsEnabled(!document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  function addIconAtPct(x: number, y: number) {
    const el: IconElement = { id: uid("icon"), kind: "icon", iconId: chosenIconId, x, y, size: 44, locked: false };
    setElements((prev) => [...prev, el]);
    setSelection(el.id);
  }

  function addLabelAtPct(x: number, y: number) {
    const el: LabelElement = {
      id: uid("label"),
      kind: "label",
      text: "Ville",
      x,
      y,
      fontSize: lastLabelFontSize,
      color: "#111827",
      bg: false,
      border: false,
      locked: false,
    };
    setElements((prev) => [...prev, el]);
    setSelection(el.id);
    setEditModal({ elementId: el.id });
  }

  function addTempAtPct(x: number, y: number) {
    const el: TempElement = {
      id: uid("temp"),
      kind: "temp",
      value: "25",
      x,
      y,
      fontSize: lastTempFontSize,
      color: "#0f172a",
      bg: false,
      border: false,
      locked: false,
    };
    setElements((prev) => [...prev, el]);
    setSelection(el.id);
    setEditModal({ elementId: el.id });
  }

  function addWindAtPct(x: number, y: number) {
    const el: WindElement = {
      id: uid("wind"),
      kind: "wind",
      speedKmh: 50,
      x,
      y,
      fontSize: lastWindFontSize,
      color: "#0369a1",
      bg: false,
      border: false,
      locked: false,
    };
    setElements((prev) => [...prev, el]);
    setSelection(el.id);
    setEditModal({ elementId: el.id });
  }

  // Drag (en %)
  const dragRef = useRef<{ ids: string[]; dx: number; dy: number } | null>(null);
  const resizeRef = useRef<
    | null
    | {
        mode: 'pressure';
        ids: string[];
        anchorId: string;
      }
    | {
        mode: 'linear';
        ids: string[];
        anchorId: string;
        startXPct: number;
        startYPct: number;
        initialSizes: Record<string, number>;
      }
  >(null);

  function onStagePointerDown(e: React.PointerEvent) {
    if (activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp" || activeTool === "add-wind") {
      if (!ghost) return;
      if (activeTool === "add-icon") addIconAtPct(ghost.x, ghost.y);
      else if (activeTool === "add-label") addLabelAtPct(ghost.x, ghost.y);
      else if (activeTool === "add-temp") addTempAtPct(ghost.x, ghost.y);
      else if (activeTool === "add-wind") addWindAtPct(ghost.x, ghost.y);
      setGhost(null);
      
      // Shift+click for icons: keep placement mode active to place multiple icons
      if (activeTool === "add-icon" && e.shiftKey) {
        // Keep placement mode active, ghost will be recreated on next mouse move
        return;
      }
      
      setActiveTool("select");
      return;
    }
    // Start drawing pressure zone
    if (activeTool === "add-anticyclone" || activeTool === "add-depression") {
      const p = stagePointPctFromEvent(e);
      setDrawingZone({ kind: activeTool === 'add-anticyclone' ? 'anticyclone' : 'depression', cx: p.xPct, cy: p.yPct, r: 2 });
      return;
    }
    
    // Selection box dragging
    const p = stagePointPctFromEvent(e);
    setIsDrawingSelection(true);
    setSelectionBox({ x0: p.xPct, y0: p.yPct, x1: p.xPct, y1: p.yPct });
  }

  // Mouse move for ghost preview and selection box
  function onStagePointerMove(e: React.PointerEvent) {
    // Resizing (pressure or linear for icons/text/wind)
    if (resizeRef.current) {
      const p = stagePointPctFromEvent(e);
      const rr = resizeRef.current;
      if (rr.mode === 'pressure') {
        const anchor = elements.find((x) => x.id === rr.anchorId) as PressureZoneElement | undefined;
        if (anchor && anchor.kind === 'pressure') {
          const dx = p.xPct - anchor.x;
          const dy = p.yPct - anchor.y;
          const rRaw = Math.sqrt(dx * dx + dy * dy);
          const r = Math.round(clamp(rRaw, 2, 50) * 10) / 10;
          setElementsTemp((prev) => prev.map((e2) => (e2.id === anchor.id ? ({ ...e2, radius: r } as ElementT) : e2)));
        }
      } else if (rr.mode === 'linear') {
        const stageW = stageSize.w || 0;
        const deltaXPx = ((p.xPct - rr.startXPct) / 100) * stageW;
        setElementsTemp((prev) =>
          prev.map((el) => {
            if (!rr.ids.includes(el.id)) return el;
            const init = rr.initialSizes[el.id];
            if (el.kind === 'icon') {
              const newSize = Math.round(clamp(init + deltaXPx * 0.8, 16, 200) * 10) / 10;
              return { ...el, size: newSize };
            }
            if (el.kind === 'label' || el.kind === 'temp' || el.kind === 'wind') {
              const newFs = Math.round(clamp(init + deltaXPx * 0.5, 10, 120) * 10) / 10;
              // Persist last size knobs when single element selected
              if (el.kind === 'label') {
                setLastLabelFontSize(newFs);
              } else if (el.kind === 'temp') {
                setLastTempFontSize(newFs);
              } else if (el.kind === 'wind') {
                setLastWindFontSize(newFs);
              }
              return { ...el, fontSize: newFs } as ElementT;
            }
            if (el.kind === 'pressure') {
              // For mixed selection, allow linear horizontal delta to adjust radius
              const newR = Math.round(clamp(init + (p.xPct - rr.startXPct), 2, 50) * 10) / 10;
              return { ...el, radius: newR } as ElementT;
            }
            return el;
          })
        );
      }
      return;
    }
    if (activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp" || activeTool === "add-wind") {
      const p = stagePointPctFromEvent(e);
      setGhost({ x: p.xPct, y: p.yPct });
      return;
    }
    // Update drawing pressure zone radius
    if (drawingZone) {
      const p = stagePointPctFromEvent(e);
      const dx = p.xPct - drawingZone.cx;
      const dy = p.yPct - drawingZone.cy;
      const r = clamp(Math.sqrt(dx * dx + dy * dy), 2, 50);
      setDrawingZone({ ...drawingZone, r });
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
    if (drawingZone) {
      setDrawingZone(null);
      setActiveTool('select');
    }
    if (isDrawingSelection) {
      setIsDrawingSelection(false);
      setSelectionBox(null);
    }
  }

  // Mouse up: finalize selection box
  function onStagePointerUp(e: React.PointerEvent) {
    if (resizeRef.current) {
      // Commit final resize state to history in a single step
      commitElements();
      resizeRef.current = null;
      return;
    }
    if (drawingZone) {
      const r = clamp(drawingZone.r, 2, 50);
      const el: PressureZoneElement = {
        id: uid('pressure'),
        kind: 'pressure',
        zone: drawingZone.kind,
        x: drawingZone.cx,
        y: drawingZone.cy,
        radius: r,
        hemisphere: 'North', // default to Northern Hemisphere
        locked: false,
      };
      setElements((prev) => [...prev, el]);
      setSelection(el.id);
      setDrawingZone(null);
      setActiveTool('select');
      return;
    }
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

  // Right click to show context menu
  function onStageContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    
    // If in placement mode, cancel it
    if (activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp" || activeTool === "add-wind" || activeTool === "add-anticyclone" || activeTool === "add-depression") {
      setGhost(null);
      setActiveTool("select");
      return;
    }
    
    // Get stage position
    const p = stagePointPctFromEvent(e as any);
    
    // Show context menu for stage
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target: 'stage',
      targetIds: [],
      stageX: p.xPct,
      stageY: p.yPct,
    });
  }

  // Right click on element
  function onElementContextMenu(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    
    // If clicked item is not selected, select it (replace selection)
    // If it's already selected (part of multi-selection), keep the selection
    if (!selectedIds.includes(id)) {
      setSelection(id);
    }
    
    // Get stage position
    const p = stagePointPctFromEvent(e as any);
    
    // Show context menu for item(s)
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      target: 'item',
      targetIds: selectedIds.includes(id) ? selectedIds : [id],
      stageX: p.xPct,
      stageY: p.yPct,
    });
  }

  // Escape key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp" || activeTool === "add-wind") && e.key === "Escape") {
        setGhost(null);
        setActiveTool("select");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeTool]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

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
    const movableIds = selectedEls.filter((elId) => {
      const el = elements.find((x) => x.id === elId);
      return !el?.locked;
    });
    const anchor = elements.find((x) => x.id === movableIds[0]);
    if (!anchor) return;
    dragRef.current = {
      ids: movableIds,
      dx: p.xPct - anchor.x,
      dy: p.yPct - anchor.y,
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
        if (d.ids.includes(el.id) && !el.locked) {
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
    const target = elements.find((e) => e.id === selectedIds[0]);
    if (!target || target.locked) return;
    setElements((prev) => prev.map((e) => (e.id === selectedIds[0] ? ({ ...e, ...patch } as ElementT) : e)));
  }

  function setLocked(ids: string[], locked: boolean) {
    if (ids.length === 0) return;
    setElements((prev) => prev.map((e) => (ids.includes(e.id) ? ({ ...e, locked } as ElementT) : e)));
  }

  function handleLabelFontSizeChange(value: number) {
    const clamped = clamp(value, 10, 80);
    const rounded = Math.round(clamped * 10) / 10;
    setLastLabelFontSize(rounded);
    localStorage.setItem('lastLabelFontSize', String(rounded));
    updateSelected({ fontSize: rounded } as any);
  }

  function handleTempFontSizeChange(value: number) {
    const clamped = clamp(value, 10, 80);
    const rounded = Math.round(clamped * 10) / 10;
    setLastTempFontSize(rounded);
    localStorage.setItem('lastTempFontSize', String(rounded));
    updateSelected({ fontSize: rounded } as any);
  }

  function handleWindFontSizeChange(value: number) {
    const clamped = clamp(value, 10, 80);
    const rounded = Math.round(clamped * 10) / 10;
    setLastWindFontSize(rounded);
    localStorage.setItem('lastWindFontSize', String(rounded));
    updateSelected({ fontSize: rounded } as any);
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
      <div className="mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gauche : carte */}
        <Card className="md:col-span-2 md:order-2 rounded-2xl shadow-sm min-w-0">
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
              <Button variant="outline" className="rounded-xl gap-2" onClick={exportProject}>
                <Download className="h-4 w-4" /> Exporter Projet
              </Button>
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => fileInputRef.current?.click()}>
                📂 Importer Projet
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                style={{ display: "none" }}
              />
              <Button variant="outline" className="rounded-xl gap-2" onClick={deleteSelected} disabled={selectedIds.length === 0}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
              <Button variant="destructive" className="rounded-xl gap-2" onClick={resetAllElements} disabled={elements.length === 0}>
                <Trash2 className="h-4 w-4" /> Réinitialiser tout
              </Button>
              <Button 
                variant={showLegend ? "default" : "outline"} 
                className="rounded-xl gap-2" 
                onClick={() => setShowLegend(!showLegend)}
              >
                📋 {showLegend ? 'Masquer' : 'Afficher'} légende
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

                  if (el.kind === "pressure") {
                    const sizePx = stageSize.w > 0 ? (el.radius / 100) * stageSize.w * 2 : 0;
                    const isAnticyclone = el.zone === 'anticyclone';
                    const fill = isAnticyclone ? 'rgba(59,130,246,0.20)' : 'rgba(239,68,68,0.20)';
                    const stroke = isAnticyclone ? '#3b82f6' : '#ef4444';
                    const labelText = el.radius >= 8 ? (isAnticyclone ? 'Anticyclone' : 'Dépression') : (isAnticyclone ? 'A' : 'D');
                    const markerId = `arrow-${el.id}`;
                    // Determine rotation direction based on hemisphere and zone type
                    // Northern Hemisphere: Anticyclones clockwise, Depressions counter-clockwise
                    // Southern Hemisphere: Anticyclones counter-clockwise, Depressions clockwise
                    const hemisphere = el.hemisphere || 'North'; // default to North for backward compatibility
                    const isNorthern = hemisphere === 'North';
                    const shouldRotateClockwise = isNorthern ? isAnticyclone : !isAnticyclone;
                    return (
                      <div
                        key={el.id}
                        onPointerDown={(e) => onElementPointerDown(e, el.id)}
                        onPointerMove={(e) => onElementPointerMove(e, el.id)}
                        onPointerUp={(e) => onElementPointerUp(e, el.id)}
                        onContextMenu={(e) => onElementContextMenu(e, el.id)}
                        className="absolute select-none"
                        style={{ left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%, -50%)', width: sizePx, height: sizePx }}
                        title={isAnticyclone ? 'Anticyclone' : 'Dépression'}
                      >
                        <div
                          className="w-full h-full"
                          style={{ borderRadius: '9999px', border: `2px solid ${stroke}`, background: fill, pointerEvents: 'none' }}
                        />
                        {/* Rotating circulation overlay */}
                        <svg
                          className="absolute inset-0"
                          viewBox="0 0 100 100"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{
                            pointerEvents: 'none',
                            transformOrigin: '50% 50%',
                            animation: 'pressure-spin 22s linear infinite',
                            animationPlayState: animationsEnabled ? 'running' : 'paused',
                            animationDirection: shouldRotateClockwise ? 'normal' : 'reverse',
                          }}
                        >
                          <defs>
                            <marker id={markerId} markerWidth="6" markerHeight="6" refX="5.5" refY="3" orient="auto">
                              <path d="M0,0 L6,3 L0,6 Z" fill={stroke} />
                            </marker>
                          </defs>
                          <g stroke={stroke} fill="none" strokeWidth="2.5" strokeLinecap="round">
                            {/* Arrows positioned on circle perimeter, tangent to circle */}
                            {[0, 60, 120, 180, 240, 300].map((angleDeg) => {
                              const radius = 35; // Circle radius in viewBox units
                              const cx = 50; // Center X
                              const cy = 50; // Center Y
                              
                              // Create a visible arc segment for the arrow line
                              // Arc spans 25 degrees to be clearly visible
                              const arcSpan = 25;
                              const startAngle = angleDeg - (shouldRotateClockwise ? arcSpan : -arcSpan);
                              const endAngle = angleDeg + (shouldRotateClockwise ? arcSpan : -arcSpan);
                              
                              const startRad = (startAngle * Math.PI) / 180;
                              const endRad = (endAngle * Math.PI) / 180;
                              
                              const x1 = cx + radius * Math.cos(startRad);
                              const y1 = cy + radius * Math.sin(startRad);
                              const x2 = cx + radius * Math.cos(endRad);
                              const y2 = cy + radius * Math.sin(endRad);
                              
                              // Arc path following the circle - longer arc for visible line
                              const arcPath = `M ${x1} ${y1} A ${radius} ${radius} 0 0 ${shouldRotateClockwise ? 1 : 0} ${x2} ${y2}`;
                              
                              return <path key={angleDeg} d={arcPath} markerEnd={`url(#${markerId})`} />;
                            })}
                          </g>
                        </svg>
                        <div
                          className="absolute inset-0 flex items-center justify-center text-center"
                          style={{ color: stroke, fontWeight: 700, pointerEvents: 'none' }}
                        >
                          {labelText}
                        </div>
                        {/* Resize handle (east) only when selected and not locked */}
                        {isSelItem && !el.locked && (
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (!isSelected(el.id)) setSelection(el.id);
                              resizeRef.current = { mode: 'pressure', ids: selectedIds, anchorId: el.id };
                              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            }}
                            className="absolute bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full"
                            style={{ left: '100%', top: '50%', transform: 'translate(-50%, -50%)', width: 12, height: 12, cursor: 'ew-resize' }}
                            title="Redimensionner"
                          />
                        )}
                      </div>
                    );
                  }
                  if (el.kind === "icon") {
                    const icon = getAvailableIcons().find((i) => i.id === el.iconId) ?? ICONS[0];
                    return (
                      <div
                        key={el.id}
                        onPointerDown={(e) => onElementPointerDown(e, el.id)}
                        onPointerMove={(e) => onElementPointerMove(e, el.id)}
                        onPointerUp={(e) => onElementPointerUp(e, el.id)}
                        onContextMenu={(e) => onElementContextMenu(e, el.id)}
                        className={baseClass}
                        style={{ left: `${el.x}%`, top: `${el.y}%`, transform: "translate(-50%, -50%)", fontSize: el.size, padding: 4 }}
                        title={icon.label}
                      >
                        <span aria-label={icon.label}>{icon.glyph}</span>
                        {/* Resize handle (east) for icons when selected and not locked */}
                        {isSelItem && !el.locked && (
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (!isSelected(el.id)) setSelection(el.id);
                              const p = stagePointPctFromEvent(e as any);
                              const resizableIds = (selectedIds.includes(el.id) ? selectedIds : [el.id]).filter((id) => {
                                const x = elements.find((ee) => ee.id === id);
                                return x && !x.locked;
                              });
                              const initialSizes: Record<string, number> = {};
                              resizableIds.forEach((rid) => {
                                const x = elements.find((ee) => ee.id === rid);
                                if (!x) return;
                                if (x.kind === 'icon') initialSizes[rid] = x.size;
                                else if (x.kind === 'label' || x.kind === 'temp' || x.kind === 'wind') initialSizes[rid] = x.fontSize as number;
                                else if (x.kind === 'pressure') initialSizes[rid] = x.radius as number;
                              });
                              resizeRef.current = {
                                mode: 'linear',
                                ids: resizableIds,
                                anchorId: el.id,
                                startXPct: p.xPct,
                                startYPct: p.yPct,
                                initialSizes,
                              };
                              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            }}
                            className="absolute bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full"
                            style={{ left: '100%', top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 10, cursor: 'ew-resize' }}
                            title="Redimensionner"
                          />
                        )}
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
                        onContextMenu={(e) => onElementContextMenu(e, el.id)}
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
                        {/* Resize handle (east) for temp when selected and not locked */}
                        {isSelItem && !el.locked && (
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (!isSelected(el.id)) setSelection(el.id);
                              const p = stagePointPctFromEvent(e as any);
                              const resizableIds = (selectedIds.includes(el.id) ? selectedIds : [el.id]).filter((id) => {
                                const x = elements.find((ee) => ee.id === id);
                                return x && !x.locked;
                              });
                              const initialSizes: Record<string, number> = {};
                              resizableIds.forEach((rid) => {
                                const x = elements.find((ee) => ee.id === rid);
                                if (!x) return;
                                if (x.kind === 'icon') initialSizes[rid] = x.size;
                                else if (x.kind === 'label' || x.kind === 'temp' || x.kind === 'wind') initialSizes[rid] = x.fontSize as number;
                                else if (x.kind === 'pressure') initialSizes[rid] = x.radius as number;
                              });
                              resizeRef.current = {
                                mode: 'linear',
                                ids: resizableIds,
                                anchorId: el.id,
                                startXPct: p.xPct,
                                startYPct: p.yPct,
                                initialSizes,
                              };
                              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            }}
                            className="absolute bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full"
                            style={{ left: '100%', top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 10, cursor: 'ew-resize' }}
                            title="Redimensionner"
                          />
                        )}
                      </div>
                    );
                  }

                  if (el.kind === "wind") {
                    return (
                      <div
                        key={el.id}
                        onPointerDown={(e) => onElementPointerDown(e, el.id)}
                        onPointerMove={(e) => onElementPointerMove(e, el.id)}
                        onPointerUp={(e) => onElementPointerUp(e, el.id)}
                        onContextMenu={(e) => onElementContextMenu(e, el.id)}
                        className={baseClass}
                        style={{ left: `${el.x}%`, top: `${el.y}%`, transform: "translate(-50%, -50%)" }}
                        title="Vent"
                      >
                        <div
                          className={"px-2 py-1 rounded-xl flex items-center gap-1 " + (el.bg ? "bg-white/90" : "bg-transparent") + (el.border ? " border shadow-sm" : "")}
                          style={{ color: el.color, fontSize: el.fontSize, fontWeight: 700, cursor: 'move' }}
                        >
                          💨 {el.speedKmh} km/h
                        </div>
                        {/* Resize handle (east) for wind when selected and not locked */}
                        {isSelItem && !el.locked && (
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (!isSelected(el.id)) setSelection(el.id);
                              const p = stagePointPctFromEvent(e as any);
                              const resizableIds = (selectedIds.includes(el.id) ? selectedIds : [el.id]).filter((id) => {
                                const x = elements.find((ee) => ee.id === id);
                                return x && !x.locked;
                              });
                              const initialSizes: Record<string, number> = {};
                              resizableIds.forEach((rid) => {
                                const x = elements.find((ee) => ee.id === rid);
                                if (!x) return;
                                if (x.kind === 'icon') initialSizes[rid] = x.size;
                                else if (x.kind === 'label' || x.kind === 'temp' || x.kind === 'wind') initialSizes[rid] = x.fontSize as number;
                                else if (x.kind === 'pressure') initialSizes[rid] = x.radius as number;
                              });
                              resizeRef.current = {
                                mode: 'linear',
                                ids: resizableIds,
                                anchorId: el.id,
                                startXPct: p.xPct,
                                startYPct: p.yPct,
                                initialSizes,
                              };
                              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            }}
                            className="absolute bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full"
                            style={{ left: '100%', top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 10, cursor: 'ew-resize' }}
                            title="Redimensionner"
                          />
                        )}
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
                      onContextMenu={(e) => onElementContextMenu(e, el.id)}
                      className={baseClass}
                      style={{ left: `${el.x}%`, top: `${el.y}%`, transform: "translate(-50%, -50%)" }}
                      title="Ville"
                    >
                      <div className={"px-2 py-1 rounded-lg " + (el.bg ? "bg-white/85 backdrop-blur" : "") + (el.border ? " border shadow-sm" : "")} style={{ color: el.color, fontSize: el.fontSize, fontWeight: 700, cursor: 'move' }}>
                        {el.text}
                      </div>
                      {/* Resize handle (east) for label when selected and not locked */}
                      {isSelItem && !el.locked && (
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (!isSelected(el.id)) setSelection(el.id);
                            const p = stagePointPctFromEvent(e as any);
                            const resizableIds = (selectedIds.includes(el.id) ? selectedIds : [el.id]).filter((id) => {
                              const x = elements.find((ee) => ee.id === id);
                              return x && !x.locked;
                            });
                            const initialSizes: Record<string, number> = {};
                            resizableIds.forEach((rid) => {
                              const x = elements.find((ee) => ee.id === rid);
                              if (!x) return;
                              if (x.kind === 'icon') initialSizes[rid] = x.size;
                              else if (x.kind === 'label' || x.kind === 'temp' || x.kind === 'wind') initialSizes[rid] = x.fontSize as number;
                              else if (x.kind === 'pressure') initialSizes[rid] = x.radius as number;
                            });
                            resizeRef.current = {
                              mode: 'linear',
                              ids: resizableIds,
                              anchorId: el.id,
                              startXPct: p.xPct,
                              startYPct: p.yPct,
                              initialSizes,
                            };
                            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                          }}
                          className="absolute bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full"
                          style={{ left: '100%', top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 10, cursor: 'ew-resize' }}
                          title="Redimensionner"
                        />
                      )}
                    </div>
                  );
                })}

                {/* Ghost preview */}
                {ghost && (activeTool === "add-icon" || activeTool === "add-label" || activeTool === "add-temp" || activeTool === "add-wind") && (
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
                          {"Ville"}
                        </div>
                      </div>
                    )}
                    {activeTool === "add-temp" && (
                      <div
                        className="absolute pointer-events-none opacity-60 select-none"
                        style={{ left: `${ghost.x}%`, top: `${ghost.y}%`, transform: "translate(-50%, -50%)" }}
                      >
                        <div className="px-2 py-1 rounded-xl bg-white/90 border shadow-sm" style={{ color: "#0f172a", fontSize: 20, fontWeight: 800 }}>
                          {`25°C`}
                        </div>
                      </div>
                    )}
                    {activeTool === "add-wind" && (
                      <div
                        className="absolute pointer-events-none opacity-60 select-none"
                        style={{ left: `${ghost.x}%`, top: `${ghost.y}%`, transform: "translate(-50%, -50%)" }}
                      >
                        <div className="px-2 py-1 rounded-xl bg-white/90 border shadow-sm flex items-center gap-1" style={{ color: "#0369a1", fontSize: 20, fontWeight: 700 }}>
                          💨 50 km/h
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Drawing pressure zone preview */}
                {drawingZone && (
                  <div
                    className="absolute pointer-events-none select-none"
                    style={{ left: `${drawingZone.cx}%`, top: `${drawingZone.cy}%`, transform: 'translate(-50%, -50%)' }}
                  >
                    <div
                      style={{
                        width: stageSize.w > 0 ? (drawingZone.r / 100) * stageSize.w * 2 : 0,
                        height: stageSize.w > 0 ? (drawingZone.r / 100) * stageSize.w * 2 : 0,
                        borderRadius: '9999px',
                        border: `2px solid ${drawingZone.kind === 'anticyclone' ? '#3b82f6' : '#ef4444'}`,
                        background: drawingZone.kind === 'anticyclone' ? 'rgba(59,130,246,0.20)' : 'rgba(239,68,68,0.20)',
                      }}
                    />
                  </div>
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

                {/* Legend */}
                {showLegend && (() => {
                  const legendEntries = generateLegend();
                  if (legendEntries.length === 0) return null;

                  const legendWidth = 160; // pixels
                  const legendHeight = 30 + legendEntries.length * 28; // dynamic height

                  return (
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const rect = stageRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        legendDragRef.current = {
                          startX: e.clientX,
                          startY: e.clientY,
                          offsetX: legendPosition.x,
                          offsetY: legendPosition.y,
                        };
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (!legendDragRef.current) return;
                        e.stopPropagation();
                        const rect = stageRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const dx = ((e.clientX - legendDragRef.current.startX) / rect.width) * 100;
                        const dy = ((e.clientY - legendDragRef.current.startY) / rect.height) * 100;
                        const newX = clamp(legendDragRef.current.offsetX + dx, 0, 100);
                        const newY = clamp(legendDragRef.current.offsetY + dy, 0, 100);
                        setLegendPosition({ x: newX, y: newY });
                      }}
                      onPointerUp={() => {
                        legendDragRef.current = null;
                      }}
                      className="absolute bg-white/95 dark:bg-slate-800/95 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-lg p-3 cursor-move select-none"
                      style={{
                        left: `${legendPosition.x}%`,
                        top: `${legendPosition.y}%`,
                        width: legendWidth,
                        transform: 'translate(0, 0)',
                        backdropFilter: 'blur(2px)',
                      }}
                      title="Drag to move legend"
                    >
                      <div className="font-bold text-sm mb-2 text-slate-800 dark:text-white">Légende</div>
                      {legendEntries.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-1 text-xs">
                          <span className="text-lg font-bold min-w-max">{entry.glyph}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-slate-700 dark:text-slate-300 truncate text-xs font-medium">{entry.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 cursor-default">
                <span className="font-semibold">Astuce :</span> clique sur « Icône / Ville / Température », puis clique sur la carte. Déplace en glissant. Clique sur un élément pour l'éditer. Glisse pour sélectionner plusieurs éléments. Shift+clic sur les icônes pour en placer plusieurs d'affilée. <span className="font-semibold">Ctrl+C / Ctrl+V</span> pour copier/coller. <span className="font-semibold">Clic droit</span> pour menu contextuel.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Modal */}
        {editModal && (() => {
          const el = elements.find(e => e.id === editModal.elementId);
          if (!el) return null;
          
          return (
            <div 
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setEditModal(null)}
            >
              <div 
                className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-5 w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Éditer {el.kind === 'icon' ? 'Icône' : el.kind === 'label' ? 'Ville' : el.kind === 'temp' ? 'Température' : 'Vent'}
                  </h3>
                  <button 
                    onClick={() => setEditModal(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>
                
                {el.kind === 'icon' && (
                  <div className="space-y-3">
                    <Label className="text-sm">Choisir un emoji</Label>
                    <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      {EMOJI_PICKER.map((emoji, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            // Create a new custom icon entry if this emoji isn't in getAvailableIcons
                            const existingIcon = getAvailableIcons().find(i => i.glyph === emoji);
                            if (existingIcon) {
                              updateSelected({ iconId: existingIcon.id } as any);
                            } else {
                              // Add as a new custom icon
                              const newCustomIcon = { id: uid('icon'), glyph: emoji, label: emoji };
                              setCustomIcons(prev => [...prev, newCustomIcon]);
                              updateSelected({ iconId: newCustomIcon.id } as any);
                            }
                          }}
                          className={`text-2xl p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 ${
                            el.iconId === (getAvailableIcons().find(i => i.glyph === emoji)?.id ?? '') ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' : ''
                          }`}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setEditModal(null)} className="rounded-lg">
                        Fermer
                      </Button>
                    </div>
                  </div>
                )}
                
                {el.kind === 'label' && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Texte</Label>
                      <Input 
                        value={el.text}
                        onChange={(e) => updateSelected({ text: e.target.value } as any)}
                        className="mt-1"
                        placeholder="Nom de ville"
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setEditModal(null)} className="rounded-lg">
                        Fermer
                      </Button>
                    </div>
                  </div>
                )}
                
                {el.kind === 'temp' && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Température</Label>
                      <Input 
                        value={el.value}
                        onChange={(e) => updateSelected({ value: e.target.value } as any)}
                        className="mt-1"
                        placeholder="25"
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setEditModal(null)} className="rounded-lg">
                        Fermer
                      </Button>
                    </div>
                  </div>
                )}
                
                {el.kind === 'wind' && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Vitesse du vent (km/h)</Label>
                      <Input 
                        type="number"
                        min={0}
                        max={300}
                        value={el.speedKmh}
                        onChange={(e) => updateSelected({ speedKmh: Number(e.target.value) } as any)}
                        className="mt-1"
                        placeholder="50"
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" onClick={() => setEditModal(null)} className="rounded-lg">
                        Fermer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 180),
              top: Math.min(contextMenu.y, window.innerHeight - 300),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.target === 'item' ? (
              // Menu for selected item(s)
              <>
                {/* Lock/Unlock */}
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    const anyLocked = contextMenu.targetIds.some(id => elements.find(e => e.id === id)?.locked);
                    setLocked(contextMenu.targetIds, !anyLocked);
                    setContextMenu(null);
                  }}
                >
                  {contextMenu.targetIds.some(id => elements.find(e => e.id === id)?.locked) ? (
                    <Unlock className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  {contextMenu.targetIds.some(id => elements.find(e => e.id === id)?.locked) ? 'Déverrouiller' : 'Verrouiller'}
                </button>
                {/* Only show Edit button for non-pressure items */}
                {!contextMenu.targetIds.every(id => elements.find(e => e.id === id)?.kind === 'pressure') && (
                  <button
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    onClick={() => {
                      // Open edit modal for the first selected item
                      if (contextMenu.targetIds.length > 0) {
                        setEditModal({ elementId: contextMenu.targetIds[0] });
                      }
                      setContextMenu(null);
                    }}
                  >
                    <Type className="h-3.5 w-3.5" />
                    Éditer
                  </button>
                )}
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    copySelected();
                    setContextMenu(null);
                  }}
                >
                  <span className="text-xs">📋</span>
                  Copier ({contextMenu.targetIds.length})
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    duplicateSelected();
                    setContextMenu(null);
                  }}
                >
                  <span className="text-xs">📑</span>
                  Dupliquer
                </button>
                {/* Hemisphere toggle for pressure zones */}
                {contextMenu.targetIds.length > 0 && 
                 contextMenu.targetIds.every(id => elements.find(e => e.id === id)?.kind === 'pressure') && (
                  <>
                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                    <div className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Hémisphère</div>
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                      onClick={() => {
                        setElements(prev => prev.map(el => 
                          contextMenu.targetIds.includes(el.id) && el.kind === 'pressure' 
                            ? { ...el, hemisphere: 'North' as const }
                            : el
                        ));
                        setContextMenu(null);
                      }}
                    >
                      <span className="text-xs">🌍</span>
                      Nord
                    </button>
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                      onClick={() => {
                        setElements(prev => prev.map(el => 
                          contextMenu.targetIds.includes(el.id) && el.kind === 'pressure' 
                            ? { ...el, hemisphere: 'South' as const }
                            : el
                        ));
                        setContextMenu(null);
                      }}
                    >
                      <span className="text-xs">🌏</span>
                      Sud
                    </button>
                  </>
                )}
                {clipboard.length > 0 && (
                  <button
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    onClick={() => {
                      pasteFromClipboard(contextMenu.stageX, contextMenu.stageY);
                      setContextMenu(null);
                    }}
                  >
                    <span className="text-xs">📄</span>
                    Coller ici
                  </button>
                )}
                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-red-600 dark:text-red-400 flex items-center gap-2"
                  onClick={() => {
                    deleteSelected();
                    setContextMenu(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer ({contextMenu.targetIds.length})
                </button>
              </>
            ) : (
              // Menu for empty stage
              <>
                <div className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Ajouter</div>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    addIconAtPct(contextMenu.stageX, contextMenu.stageY);
                    setContextMenu(null);
                  }}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Icône météo
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    setActiveTool('add-anticyclone');
                    setContextMenu(null);
                  }}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Anticyclone (outil)
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    setActiveTool('add-depression');
                    setContextMenu(null);
                  }}
                >
                  <Thermometer className="h-3.5 w-3.5" />
                  Dépression (outil)
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    addLabelAtPct(contextMenu.stageX, contextMenu.stageY);
                    setContextMenu(null);
                  }}
                >
                  <Type className="h-3.5 w-3.5" />
                  Nom de ville
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    addTempAtPct(contextMenu.stageX, contextMenu.stageY);
                    setContextMenu(null);
                  }}
                >
                  <Thermometer className="h-3.5 w-3.5" />
                  Température
                </button>
                <button
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  onClick={() => {
                    addWindAtPct(contextMenu.stageX, contextMenu.stageY);
                    setContextMenu(null);
                  }}
                >
                  <Wind className="h-3.5 w-3.5" />
                  Force du vent
                </button>
                {clipboard.length > 0 && (
                  <>
                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                    <button
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                      onClick={() => {
                        pasteFromClipboard(contextMenu.stageX, contextMenu.stageY);
                        setContextMenu(null);
                      }}
                    >
                      <span className="text-xs">📄</span>
                      Coller ({clipboard.length})
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Droite : panneau */}
        <Card className="rounded-2xl shadow-sm min-w-0 md:order-1 md:sticky md:top-4 self-start h-max">
          <CardContent className="p-4 md:p-5 space-y-3 max-h-[calc(100vh-2rem)] overflow-auto">
            <div>
              <div className="text-lg font-semibold mb-2">Outils</div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant={activeTool === "select" ? "default" : "outline"} onClick={() => setActiveTool("select")} className="rounded-lg" size="sm">
                  <MousePointer2 className="h-4 w-4" /> Sélection
                </Button>
                <Button variant={activeTool === "add-icon" ? "default" : "outline"} onClick={() => setActiveTool("add-icon")} className="rounded-lg" size="sm">
                  <ImageIcon className="h-4 w-4" />Icone
                </Button>
                <Button variant={activeTool === "add-label" ? "default" : "outline"} onClick={() => setActiveTool("add-label")} className="rounded-lg" size="sm">
                  <Type className="h-4 w-4" /> Nom de ville
                </Button>
                <Button variant={activeTool === "add-temp" ? "default" : "outline"} onClick={() => setActiveTool("add-temp")} className="rounded-lg" size="sm">
                  <Thermometer className="h-4 w-4" /> Température
                </Button>
                <Button variant={activeTool === "add-wind" ? "default" : "outline"} onClick={() => setActiveTool("add-wind")} className="rounded-lg" size="sm">
                  <Wind className="h-4 w-4" /> Force du vent
                </Button>
                <Button variant={activeTool === "add-anticyclone" ? "default" : "outline"} onClick={() => setActiveTool("add-anticyclone")} className="rounded-lg" size="sm">
                  <Sun className="h-4 w-4" /> Anticyclone
                </Button>
                <Button variant={activeTool === "add-depression" ? "default" : "outline"} onClick={() => setActiveTool("add-depression")} className="rounded-lg" size="sm">
                  <Thermometer className="h-4 w-4" /> Dépression
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="font-semibold text-sm">Evènement météorologique</div>
              <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto overflow-x-hidden pr-1">
                {getAvailableIcons().map((ic) => (
                  <div key={ic.id} className="relative">
                    <Button
                      variant={chosenIconId === ic.id ? "default" : "outline"}
                      className="h-10 w-full p-1 rounded-lg"
                      size="sm"
                      onClick={() => {
                        setChosenIconId(ic.id);
                        setActiveTool("add-icon");
                      }}
                      title={ic.label}
                    >
                      <span className="text-xl">{ic.glyph}</span>
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

              <details className="pt-2 border-t">
                <summary className="text-xs font-semibold cursor-pointer hover:text-blue-600">Créer icône perso</summary>
                <div className="space-y-2 mt-2">
                  <details>
                    <summary className="text-xs cursor-pointer mb-1">Emojis 😊</summary>
                    <div className="grid grid-cols-8 gap-1 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg max-h-24 overflow-y-auto mt-1">
                      {EMOJI_PICKER.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNewCustomIconGlyph(emoji)}
                          className={`text-lg p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 ${
                            newCustomIconGlyph === emoji ? 'bg-slate-300 dark:bg-slate-500 ring-1 ring-blue-500' : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </details>
                  <div className="flex gap-1">
                    <Input
                      type="text"
                      value={newCustomIconGlyph}
                      onChange={(e) => setNewCustomIconGlyph(e.target.value)}
                      maxLength={2}
                      className="w-12 text-center text-lg h-8 p-1"
                    />
                    <Input
                      type="text"
                      placeholder="Nom"
                      value={newCustomIconLabel}
                      onChange={(e) => setNewCustomIconLabel(e.target.value)}
                      className="flex-1 h-8 text-xs"
                    />
                    <Button size="sm" className="rounded-lg h-8 px-2 text-xs" onClick={addCustomIcon}>
                      +
                    </Button>
                  </div>
                </div>
              </details>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="font-semibold text-sm">Éditer</div>
              {selectedIds.length === 0 ? (
                <div className="text-xs text-slate-500 cursor-default">Aucun élément sélectionné</div>
              ) : selectedIds.length > 1 ? (
                <div className="text-xs text-slate-700">
                  <span className="font-semibold">{selectedIds.length} éléments</span>
                </div>
              ) : selected?.kind === "icon" ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold">{selectedIcon?.label ?? "Icône"}</div>
                  <div>
                    <Label className="text-xs">Taille</Label>
                    <Input type="range" min={24} max={80} value={selected.size} onChange={(e) => updateSelected({ size: Number(e.target.value) } as any)} className="h-6" />
                  </div>
                </div>
              ) : selected?.kind === "label" ? (
                <div className="space-y-2">
                  <Input value={selected.text} onChange={(e) => updateSelected({ text: e.target.value } as any)} className="h-8 text-xs" placeholder="Texte" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Taille</Label>
                      <Input type="number" min={10} max={80} value={selected.fontSize} onChange={(e) => handleLabelFontSizeChange(Number(e.target.value))} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Couleur</Label>
                      <Input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value } as any)} className="h-8" />
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selected.bg} onChange={(e) => updateSelected({ bg: e.target.checked } as any)} className="w-3 h-3" />
                      Fond
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selected.border} onChange={(e) => updateSelected({ border: e.target.checked } as any)} className="w-3 h-3" />
                      Bordure
                    </label>
                  </div>
                </div>
              ) : selected?.kind === "temp" ? (
                <div className="space-y-2">
                  <Input value={selected.value} onChange={(e) => updateSelected({ value: e.target.value } as any)} className="h-8 text-xs" placeholder="Température" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Taille</Label>
                      <Input type="number" min={10} max={80} value={selected.fontSize} onChange={(e) => handleTempFontSizeChange(Number(e.target.value))} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Couleur</Label>
                      <Input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value } as any)} className="h-8" />
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selected.bg} onChange={(e) => updateSelected({ bg: e.target.checked } as any)} className="w-3 h-3" />
                      Fond
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selected.border} onChange={(e) => updateSelected({ border: e.target.checked } as any)} className="w-3 h-3" />
                      Bordure
                    </label>
                  </div>
                </div>
              ) : selected?.kind === "wind" ? (
                <div className="space-y-2">
                  <Input 
                    type="number" 
                    min={0} 
                    max={300} 
                    value={selected.speedKmh} 
                    onChange={(e) => updateSelected({ speedKmh: Number(e.target.value) } as any)} 
                    className="h-8 text-xs"
                    placeholder="Vitesse km/h"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Taille</Label>
                      <Input type="number" min={10} max={80} value={selected.fontSize} onChange={(e) => handleWindFontSizeChange(Number(e.target.value))} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Couleur</Label>
                      <Input type="color" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value } as any)} className="h-8" />
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selected.bg} onChange={(e) => updateSelected({ bg: e.target.checked } as any)} className="w-3 h-3" />
                      Fond
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={selected.border} onChange={(e) => updateSelected({ border: e.target.checked } as any)} className="w-3 h-3" />
                      Bordure
                    </label>
                  </div>
                </div>
              ) : selected?.kind === "pressure" ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold">{selected.zone === 'anticyclone' ? 'Anticyclone' : 'Dépression'}</div>
                  <div>
                    <Label className="text-xs">Rayon</Label>
                    <Input type="range" min={2} max={50} value={selected.radius} onChange={(e) => updateSelected({ radius: Number(e.target.value) } as any)} className="h-6" />
                  </div>
                  <div>
                    <Label className="text-xs">Hémisphère</Label>
                    <select 
                      value={selected.hemisphere || 'North'} 
                      onChange={(e) => updateSelected({ hemisphere: e.target.value as 'North' | 'South' } as any)}
                      className="w-full h-8 text-xs border border-slate-300 dark:border-slate-600 rounded-md px-2 bg-white dark:bg-slate-800"
                    >
                      <option value="North">Nord</option>
                      <option value="South">Sud</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
