import {
  LEAFLET_BG_ID,
  builtinBackground,
  createEmptyDocument,
  type Background,
  type CustomIcon,
  type MapDocument,
  type MapElement,
} from "./model";

const STORAGE_KEY = "weathermap_project";
const FILE_VERSION = 2;

type ProjectFileV2 = {
  app: "weathermap";
  version: 2;
  savedAt: string;
} & MapDocument;

/** Format des projets enregistrés avant la refonte */
type ProjectFileV1 = {
  version: 1;
  bgId: string;
  bgUrl: string | null;
  aspectRatio: string;
  elements: unknown[];
  customIcons?: CustomIcon[];
};

// ---------- Sérialisation ----------

export function serializeProject(doc: MapDocument): string {
  const file: ProjectFileV2 = { app: "weathermap", version: FILE_VERSION, savedAt: new Date().toISOString(), ...doc };
  return JSON.stringify(file, null, 2);
}

export class ProjectFormatError extends Error {}

export function parseProject(json: string): MapDocument {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ProjectFormatError("Ce fichier n'est pas un projet de carte météo valide.");
  }
  if (!isRecord(data) || !Array.isArray(data.elements)) {
    throw new ProjectFormatError("Ce fichier n'est pas un projet de carte météo valide.");
  }
  if (data.version === 1) return migrateV1(data as ProjectFileV1);
  if (data.version === 2) return normalizeDocument(data as Partial<ProjectFileV2>);
  throw new ProjectFormatError("Ce projet a été créé avec une version plus récente de l'éditeur.");
}

function migrateV1(data: ProjectFileV1): MapDocument {
  const background: Background = builtinBackground(data.bgId) ?? {
    id: data.bgId,
    url: data.bgUrl,
    aspect: parseAspect(data.aspectRatio),
  };
  return normalizeDocument({ background, elements: data.elements as MapElement[], customIcons: data.customIcons });
}

function normalizeDocument(data: Partial<MapDocument>): MapDocument {
  const empty = createEmptyDocument();
  const bg = data.background;
  // Les fonds intégrés sont résolus par leur id : leurs URL changent d'un déploiement à l'autre
  const background =
    (bg && builtinBackground(bg.id)) ??
    (bg && (bg.url || bg.id === LEAFLET_BG_ID) ? { id: bg.id, url: bg.url, aspect: bg.aspect || 16 / 9 } : empty.background);

  return {
    background,
    elements: (data.elements ?? []).filter(isValidElement).map(normalizeElement),
    customIcons: (data.customIcons ?? []).filter((ic) => isRecord(ic) && typeof ic.id === "string"),
    legend: { ...empty.legend, ...data.legend },
  };
}

const KINDS = new Set(["icon", "label", "temp", "wind", "pressure"]);

function isValidElement(el: unknown): el is MapElement {
  return (
    isRecord(el) &&
    typeof el.id === "string" &&
    typeof el.kind === "string" &&
    KINDS.has(el.kind) &&
    typeof el.x === "number" &&
    typeof el.y === "number"
  );
}

function normalizeElement(el: MapElement): MapElement {
  if (el.kind === "pressure") return { ...el, hemisphere: el.hemisphere ?? "North" };
  if (el.kind === "temp") return { ...el, value: String(el.value ?? "") };
  return el;
}

function parseAspect(ratio: string | undefined): number {
  const [w, h] = (ratio ?? "").split("/").map((s) => parseFloat(s));
  return w > 0 && h > 0 ? w / h : 16 / 9;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// ---------- Sauvegarde automatique ----------

export function loadAutosave(): MapDocument | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseProject(stored) : null;
  } catch {
    return null;
  }
}

/** Renvoie false si le navigateur refuse (quota dépassé, souvent à cause d'une image importée trop lourde) */
export function saveAutosave(doc: MapDocument): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProject(doc));
    return true;
  } catch {
    return false;
  }
}

// ---------- Fichiers ----------

export function downloadFile(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

export function downloadText(content: string, filename: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  downloadFile(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function loadImageAspect(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = reject;
    img.src = src;
  });
}

export function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
