import franceImg from "/img/france.png";
import europeImg from "/img/europe.png";
import worldImg from "/img/world.png";

// ---------- Éléments posés sur la carte ----------
// Les positions (x, y) sont en % de la carte. Les tailles (size, fontSize)
// sont exprimées pour une carte de REFERENCE_WIDTH px de large, puis mises
// à l'échelle : la carte garde les mêmes proportions quelle que soit la
// taille de l'écran ou de l'export.

export const REFERENCE_WIDTH = 1000;

type BaseElement = {
  id: string;
  x: number;
  y: number;
  locked?: boolean;
};

type TextStyle = {
  fontSize: number;
  color: string;
  bg: boolean;
  border: boolean;
};

export type IconElement = BaseElement & {
  kind: "icon";
  iconId: string;
  size: number;
};

export type LabelElement = BaseElement &
  TextStyle & {
    kind: "label";
    text: string;
  };

export type TempElement = BaseElement &
  TextStyle & {
    kind: "temp";
    value: string;
    /** "auto" colore la pastille selon la valeur. Absent = ancien projet = couleur perso. */
    colorMode?: "auto" | "custom";
  };

export type WindElement = BaseElement &
  TextStyle & {
    kind: "wind";
    speedKmh: number;
  };

export type PressureElement = BaseElement & {
  kind: "pressure";
  zone: "anticyclone" | "depression";
  /** Rayon en % de la largeur de la carte */
  radius: number;
  hemisphere: "North" | "South";
};

export type MapElement = IconElement | LabelElement | TempElement | WindElement | PressureElement;
export type ElementKind = MapElement["kind"];
export type TextElement = LabelElement | TempElement | WindElement;

export function isTextElement(el: MapElement): el is TextElement {
  return el.kind === "label" || el.kind === "temp" || el.kind === "wind";
}

// ---------- Document ----------

export type CustomIcon = { id: string; label: string; glyph: string };

export type Background = {
  id: string;
  /** URL de l'image (null pour la carte interactive non capturée) */
  url: string | null;
  /** largeur / hauteur */
  aspect: number;
};

export type LegendState = { visible: boolean; x: number; y: number };

export type MapDocument = {
  background: Background;
  elements: MapElement[];
  customIcons: CustomIcon[];
  legend: LegendState;
};

// ---------- Fonds de carte ----------

const BLANK_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='900' viewBox='0 0 1600 900'>
<defs>
<linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#e0f2fe'/><stop offset='1' stop-color='#f8fafc'/></linearGradient>
<pattern id='p' width='80' height='80' patternUnits='userSpaceOnUse'><path d='M80 0H0V80' fill='none' stroke='#cbd5e1' stroke-width='1'/></pattern>
</defs>
<rect width='1600' height='900' fill='url(#g)'/><rect width='1600' height='900' fill='url(#p)' opacity='0.5'/>
</svg>`;

export type BuiltinBackground = {
  id: string;
  label: string;
  description: string;
  src: string | null;
  aspect: number;
};

export const BUILTIN_BACKGROUNDS: BuiltinBackground[] = [
  { id: "france", label: "France", description: "Régions et départements", src: franceImg, aspect: 1248 / 1200 },
  { id: "europe", label: "Europe", description: "Pays européens", src: europeImg, aspect: 983 / 900 },
  { id: "world", label: "Monde", description: "Planisphère", src: worldImg, aspect: 1500 / 740 },
  {
    id: "grid",
    label: "Grille vierge",
    description: "Fond neutre quadrillé",
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(BLANK_SVG)}`,
    aspect: 16 / 9,
  },
];

export const LEAFLET_BG_ID = "leaflet";
export const LEAFLET_CAPTURED_BG_ID = "leaflet-captured";
export const UPLOAD_BG_ID = "upload";

export function builtinBackground(id: string): Background | null {
  const bg = BUILTIN_BACKGROUNDS.find((b) => b.id === id);
  return bg ? { id: bg.id, url: bg.src, aspect: bg.aspect } : null;
}

// ---------- Pictos ----------

/** Pictos intégrés : dessinés en SVG (voir WeatherIcon.tsx). L'emoji sert de repli texte. */
export const BUILTIN_ICONS: CustomIcon[] = [
  { id: "sun", label: "Soleil", glyph: "☀️" },
  { id: "partly", label: "Éclaircies", glyph: "⛅" },
  { id: "cloud", label: "Nuages", glyph: "☁️" },
  { id: "rain", label: "Pluie", glyph: "🌧️" },
  { id: "storm", label: "Orage", glyph: "⛈️" },
  { id: "snow", label: "Neige", glyph: "🌨️" },
  { id: "fog", label: "Brouillard", glyph: "🌫️" },
  { id: "wind", label: "Vent", glyph: "💨" },
  { id: "hot", label: "Canicule", glyph: "🌡️" },
  { id: "drought", label: "Sécheresse", glyph: "🏜️" },
  { id: "wildfire", label: "Incendie", glyph: "🔥" },
  { id: "flood", label: "Inondation", glyph: "🌊" },
  { id: "cyclone", label: "Cyclone", glyph: "🌀" },
];

export function findIcon(id: string, customIcons: CustomIcon[]): CustomIcon {
  return (
    BUILTIN_ICONS.find((i) => i.id === id) ??
    customIcons.find((i) => i.id === id) ?? { id, label: "Picto", glyph: "❓" }
  );
}

export const EMOJI_CHOICES = [
  "⭐", "🌈", "☔", "🌤️", "🌥️", "🌦️", "☃️", "❄️",
  "🌡️", "🧊", "💧", "💦", "🌊", "🔥", "💨", "🌀",
  "⚡", "🌩️", "🌪️", "🌫️", "☁️", "🌬️", "🍃", "🌾",
  "🏔️", "🏖️", "🏝️", "🌋", "⛰️", "🏜️", "🐻‍❄️", "🐟",
  "🌍", "🌎", "🌏", "🗺️", "🧭", "📍", "⚠️", "❗",
];

// ---------- Valeurs par défaut ----------

export const DEFAULT_TEXT_SIZE = 20;

export const TEXT_DEFAULTS = {
  label: { text: "Ville", color: "#0f172a" },
  temp: { value: "25", color: "#0f172a" },
  wind: { speedKmh: 50, color: "#0369a1" },
} as const;

export const PRESSURE_COLORS = {
  anticyclone: { stroke: "#2563eb", fill: "rgba(37, 99, 235, 0.16)" },
  depression: { stroke: "#dc2626", fill: "rgba(220, 38, 38, 0.16)" },
} as const;

/** Sous ce rayon, le cercle affiche « A » / « D » au lieu du mot complet */
export const PRESSURE_SHORT_LABEL_RADIUS = 8;

export const ELEMENT_NAMES: Record<ElementKind, string> = {
  icon: "Picto",
  label: "Ville",
  temp: "Température",
  wind: "Vent",
  pressure: "Zone de pression",
};

export function createEmptyDocument(): MapDocument {
  return {
    background: builtinBackground("france")!,
    elements: [],
    customIcons: [],
    legend: { visible: true, x: 2, y: 2 },
  };
}

// ---------- Utilitaires ----------

export function uid(prefix = "el") {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Couleur de pastille façon bulletin TV, du bleu glacial au rouge brûlant */
export function temperatureColor(value: string): string {
  const n = parseFloat(value.replace(",", "."));
  if (Number.isNaN(n)) return "#475569";
  const stops: [number, string][] = [
    [-10, "#6d28d9"],
    [0, "#2563eb"],
    [10, "#0891b2"],
    [18, "#16a34a"],
    [24, "#ca8a04"],
    [30, "#ea580c"],
    [36, "#dc2626"],
    [42, "#9f1239"],
  ];
  let color = stops[0][1];
  for (const [threshold, c] of stops) if (n >= threshold) color = c;
  return color;
}

export function formatTemperature(value: string) {
  return value.includes("°") ? value : `${value}°C`;
}
