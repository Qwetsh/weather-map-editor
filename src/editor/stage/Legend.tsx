import { BUILTIN_ICONS, PRESSURE_COLORS, PRESSURE_SHORT_LABEL_RADIUS, clamp, type MapDocument } from "../model";
import { WeatherIcon } from "../WeatherIcon";

type Entry = { key: string; label: string; visual: React.ReactNode };

/** Légende générée à partir des éléments présents sur la carte */
function legendEntries(doc: MapDocument, size: number): Entry[] {
  const iconIds = new Set<string>();
  const pressures = new Set<"anticyclone" | "depression">();
  let hasWind = false;

  for (const el of doc.elements) {
    if (el.kind === "icon") iconIds.add(el.iconId);
    // Seuls les petits cercles affichent « A » / « D » et ont besoin d'une légende
    else if (el.kind === "pressure" && el.radius < PRESSURE_SHORT_LABEL_RADIUS) pressures.add(el.zone);
    else if (el.kind === "wind") hasWind = true;
  }

  const entries: Entry[] = [];
  for (const icon of [...BUILTIN_ICONS, ...doc.customIcons]) {
    if (iconIds.has(icon.id)) {
      entries.push({
        key: icon.id,
        label: icon.label,
        visual: <WeatherIcon iconId={icon.id} customIcons={doc.customIcons} size={size} />,
      });
    }
  }
  for (const zone of ["anticyclone", "depression"] as const) {
    if (!pressures.has(zone)) continue;
    const { stroke, fill } = PRESSURE_COLORS[zone];
    entries.push({
      key: zone,
      label: zone === "anticyclone" ? "Anticyclone" : "Dépression",
      visual: (
        <span
          className="grid place-items-center rounded-full font-bold"
          style={{ width: size, height: size, color: stroke, background: fill, border: `2px solid ${stroke}`, fontSize: size * 0.5 }}
        >
          {zone === "anticyclone" ? "A" : "D"}
        </span>
      ),
    });
  }
  if (hasWind && !iconIds.has("wind")) {
    entries.push({ key: "wind", label: "Vent", visual: <WeatherIcon iconId="wind" customIcons={[]} size={size} /> });
  }
  return entries;
}

export function Legend({ doc, scale }: { doc: MapDocument; scale: number }) {
  const s = clamp(scale, 0.7, 1.6);
  const entries = legendEntries(doc, 22 * s);
  if (!doc.legend.visible || entries.length === 0) return null;

  return (
    <div
      data-legend
      className="absolute cursor-move touch-none rounded-xl border border-slate-200 bg-white/95 text-slate-800 shadow-lg select-none"
      style={{ left: `${doc.legend.x}%`, top: `${doc.legend.y}%`, padding: `${10 * s}px ${12 * s}px`, fontSize: 13 * s }}
      title="Fais glisser pour déplacer la légende"
    >
      <div className="font-bold" style={{ fontSize: 14 * s, marginBottom: 6 * s }}>
        Légende
      </div>
      <ul className="grid" style={{ gap: 5 * s }}>
        {entries.map((e) => (
          <li key={e.key} className="flex items-center font-medium" style={{ gap: 8 * s }}>
            {e.visual}
            {e.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
