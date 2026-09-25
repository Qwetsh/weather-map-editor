import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { toPng } from "html-to-image";
import {
  DEFAULT_TEXT_SIZE,
  LEAFLET_BG_ID,
  LEAFLET_CAPTURED_BG_ID,
  TEXT_DEFAULTS,
  UPLOAD_BG_ID,
  clamp,
  createEmptyDocument,
  isTextElement,
  uid,
  type Background,
  type CustomIcon,
  type LegendState,
  type MapDocument,
  type MapElement,
  type PressureElement,
  type TextElement,
} from "./model";
import {
  ProjectFormatError,
  dateStamp,
  downloadFile,
  downloadText,
  loadAutosave,
  loadImageAspect,
  parseProject,
  readFileAsDataUrl,
  saveAutosave,
  serializeProject,
} from "./project";
import { useHistory } from "./useHistory";
import type { PlacementTool, Tool } from "./tools";

type Theme = "light" | "dark";
type TextKind = TextElement["kind"];

type Toast = { id: number; message: string; tone: "info" | "error" };

type Prefs = { theme: Theme; textSizes: Record<TextKind, number> };

const PREFS_KEY = "weathermap_prefs";

function loadPrefs(): Prefs {
  const fallback: Prefs = {
    theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    textSizes: { label: DEFAULT_TEXT_SIZE, temp: DEFAULT_TEXT_SIZE, wind: DEFAULT_TEXT_SIZE },
  };
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
    return stored ? { ...fallback, ...stored, textSizes: { ...fallback.textSizes, ...stored.textSizes } } : fallback;
  } catch {
    return fallback;
  }
}

type Patch = Partial<MapElement> | ((el: MapElement) => MapElement);

function applyPatch(el: MapElement, patch: Patch): MapElement {
  return typeof patch === "function" ? patch(el) : ({ ...el, ...patch } as MapElement);
}

function useEditorState(stageRef: RefObject<HTMLDivElement | null>) {
  const history = useHistory<MapDocument>(() => loadAutosave() ?? createEmptyDocument());
  const doc = history.present;
  const { set: setDoc, preview: previewDoc } = history;

  const [tool, setTool] = useState<Tool>("select");
  const [iconId, setIconId] = useState("sun");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<MapElement[]>([]);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [exporting, setExporting] = useState(false);
  /** Élément dont le champ principal doit recevoir le focus dans le panneau de droite */
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // ---------- Effets de bord : thème, préférences, sauvegarde auto ----------

  useEffect(() => {
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const autosaveWarned = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      const ok = saveAutosave(doc);
      if (!ok && !autosaveWarned.current) {
        autosaveWarned.current = true;
        notify("Sauvegarde automatique impossible : l'image de fond est trop lourde. Pense à enregistrer ton projet.", "error");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [doc]);

  // Désélectionne ce qui a disparu (annulation, suppression…)
  const elementIds = useMemo(() => new Set(doc.elements.map((e) => e.id)), [doc.elements]);
  const liveSelection = useMemo(() => selectedIds.filter((id) => elementIds.has(id)), [selectedIds, elementIds]);

  const selectedElements = useMemo(
    () => doc.elements.filter((e) => liveSelection.includes(e.id)),
    [doc.elements, liveSelection],
  );

  function notify(message: string, tone: Toast["tone"] = "info") {
    setToast({ id: Date.now(), message, tone });
  }

  // ---------- Éléments ----------

  const updateElements = useCallback(
    (ids: string[], patch: Patch, options?: { coalesce?: string; preview?: boolean }) => {
      const updater = (d: MapDocument) => ({
        ...d,
        elements: d.elements.map((el) => (ids.includes(el.id) ? applyPatch(el, patch) : el)),
      });
      if (options?.preview) previewDoc(updater);
      else setDoc(updater, options);
    },
    [setDoc, previewDoc],
  );

  function addElements(els: MapElement[]) {
    setDoc((d) => ({ ...d, elements: [...d.elements, ...els] }));
    setSelectedIds(els.map((e) => e.id));
  }

  function addElementAt(kind: PlacementTool, x: number, y: number) {
    const base = { id: uid(kind), x, y, locked: false };
    let el: MapElement;
    if (kind === "icon") {
      el = { ...base, kind, iconId, size: 48 };
    } else {
      const style = { fontSize: prefs.textSizes[kind], bg: false, border: false };
      if (kind === "label") el = { ...base, ...style, kind, ...TEXT_DEFAULTS.label };
      else if (kind === "temp") el = { ...base, ...style, kind, ...TEXT_DEFAULTS.temp, colorMode: "auto" };
      else el = { ...base, ...style, kind, ...TEXT_DEFAULTS.wind };
    }
    addElements([el]);
    // Les textes s'éditent tout de suite dans le panneau de droite
    if (kind !== "icon") setFocusTarget(el.id);
  }

  function addPressure(zone: PressureElement["zone"], x: number, y: number, radius: number) {
    addElements([{ id: uid("pressure"), kind: "pressure", zone, x, y, radius, hemisphere: "North", locked: false }]);
  }

  function deleteElements(ids: string[]) {
    if (ids.length === 0) return;
    setDoc((d) => ({ ...d, elements: d.elements.filter((e) => !ids.includes(e.id)) }));
    setSelectedIds([]);
  }

  function cloneElements(els: MapElement[], offset: number, at?: { x: number; y: number }) {
    const cx = els.reduce((s, e) => s + e.x, 0) / els.length;
    const cy = els.reduce((s, e) => s + e.y, 0) / els.length;
    return els.map((el) => ({
      ...el,
      id: uid(el.kind),
      locked: false,
      x: clamp(at ? at.x + el.x - cx : el.x + offset, 0, 100),
      y: clamp(at ? at.y + el.y - cy : el.y + offset, 0, 100),
    }));
  }

  function duplicate(ids = liveSelection) {
    const els = doc.elements.filter((e) => ids.includes(e.id));
    if (els.length) addElements(cloneElements(els, 3));
  }

  function copy(ids = liveSelection) {
    const els = doc.elements.filter((e) => ids.includes(e.id));
    if (els.length) {
      setClipboard(els);
      notify(els.length > 1 ? `${els.length} éléments copiés` : "Élément copié");
    }
  }

  function paste(at?: { x: number; y: number }) {
    if (clipboard.length) addElements(cloneElements(clipboard, 3, at));
  }

  function setLocked(ids: string[], locked: boolean) {
    updateElements(ids, { locked });
  }

  function reorder(ids: string[], where: "front" | "back") {
    setDoc((d) => {
      const moving = d.elements.filter((e) => ids.includes(e.id));
      const rest = d.elements.filter((e) => !ids.includes(e.id));
      return { ...d, elements: where === "front" ? [...rest, ...moving] : [...moving, ...rest] };
    });
  }

  function nudge(dx: number, dy: number) {
    const ids = selectedElements.filter((e) => !e.locked).map((e) => e.id);
    if (!ids.length) return;
    updateElements(ids, (el) => ({ ...el, x: clamp(el.x + dx, 0, 100), y: clamp(el.y + dy, 0, 100) }), {
      coalesce: `nudge:${ids.join()}`,
    });
  }

  function rememberTextSize(kind: TextKind, size: number) {
    setPrefs((p) => ({ ...p, textSizes: { ...p.textSizes, [kind]: size } }));
  }

  // ---------- Pictos perso ----------

  function addCustomIcon(glyph: string, label: string): CustomIcon {
    const existing = doc.customIcons.find((i) => i.glyph === glyph);
    if (existing) return existing;
    const icon = { id: uid("custom"), glyph, label: label || glyph };
    setDoc((d) => ({ ...d, customIcons: [...d.customIcons, icon] }));
    return icon;
  }

  function removeCustomIcon(id: string) {
    setDoc((d) => ({
      ...d,
      customIcons: d.customIcons.filter((i) => i.id !== id),
      elements: d.elements.filter((e) => !(e.kind === "icon" && e.iconId === id)),
    }));
    if (iconId === id) setIconId("sun");
  }

  // ---------- Fond de carte ----------

  function setBackground(background: Background) {
    setDoc((d) => ({ ...d, background }));
    setTool("select");
  }

  async function uploadBackground(file: File) {
    try {
      const url = await readFileAsDataUrl(file);
      setBackground({ id: UPLOAD_BG_ID, url, aspect: await loadImageAspect(url) });
    } catch {
      notify("Impossible de lire cette image.", "error");
    }
  }

  function openInteractiveMap() {
    setBackground({ id: LEAFLET_BG_ID, url: null, aspect: 16 / 9 });
  }

  function captureInteractiveMap(url: string, aspect: number) {
    setBackground({ id: LEAFLET_CAPTURED_BG_ID, url, aspect });
  }

  // ---------- Légende ----------

  function updateLegend(patch: Partial<LegendState>, options?: { preview?: boolean }) {
    const updater = (d: MapDocument) => ({ ...d, legend: { ...d.legend, ...patch } });
    if (options?.preview) previewDoc(updater);
    else setDoc(updater);
  }

  // ---------- Projet ----------

  function newMap() {
    setDoc((d) => ({ ...d, elements: [] }));
    setSelectedIds([]);
    notify("Carte effacée — Ctrl+Z pour revenir en arrière");
  }

  function saveProjectFile() {
    downloadText(serializeProject(doc), `carte-meteo-${dateStamp()}.json`);
  }

  async function openProjectFile(file: File) {
    try {
      const loaded = parseProject(await file.text());
      history.reset(loaded);
      setSelectedIds([]);
      setTool("select");
      notify(`Projet « ${file.name} » ouvert`);
    } catch (e) {
      notify(e instanceof ProjectFormatError ? e.message : "Impossible d'ouvrir ce fichier.", "error");
    }
  }

  async function exportPng() {
    const stage = stageRef.current;
    if (!stage) return;
    setExporting(true);
    // Laisse React masquer la sélection et les poignées avant la capture
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const pixelRatio = Math.max(2, 1600 / stage.offsetWidth);
      const dataUrl = await toPng(stage, { pixelRatio, cacheBust: true, backgroundColor: "#ffffff" });
      downloadFile(dataUrl, `carte-meteo-${dateStamp()}.png`);
    } catch (e) {
      console.error(e);
      notify("L'export a échoué. Réessaie dans un instant.", "error");
    } finally {
      setExporting(false);
    }
  }

  return {
    doc,
    history,
    tool,
    setTool,
    iconId,
    chooseIcon: (id: string) => {
      setIconId(id);
      setTool("icon");
    },
    selectedIds: liveSelection,
    selectedElements,
    setSelectedIds,
    clipboard,
    theme: prefs.theme,
    toggleTheme: () => setPrefs((p) => ({ ...p, theme: p.theme === "light" ? "dark" : "light" })),
    exporting,
    focusTarget,
    requestFocus: (id = liveSelection[0]) => {
      const el = doc.elements.find((e) => e.id === id);
      if (el && isTextElement(el)) setFocusTarget(el.id);
    },
    clearFocusTarget: () => setFocusTarget(null),
    toast,
    dismissToast: () => setToast(null),
    notify,
    // éléments
    previewDoc,
    commitPreview: history.commitPreview,
    updateElements,
    addElementAt,
    addPressure,
    deleteElements,
    duplicate,
    copy,
    paste,
    setLocked,
    reorder,
    nudge,
    rememberTextSize,
    // pictos
    addCustomIcon,
    removeCustomIcon,
    // fond
    setBackground,
    uploadBackground,
    openInteractiveMap,
    captureInteractiveMap,
    // légende
    updateLegend,
    // projet
    newMap,
    saveProjectFile,
    openProjectFile,
    exportPng,
  };
}

export type EditorApi = ReturnType<typeof useEditorState>;

const EditorContext = createContext<(EditorApi & { stageRef: RefObject<HTMLDivElement | null> }) | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const api = useEditorState(stageRef);
  return <EditorContext.Provider value={{ ...api, stageRef }}>{children}</EditorContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor doit être utilisé dans <EditorProvider>");
  return ctx;
}
