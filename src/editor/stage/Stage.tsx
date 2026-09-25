import { lazy, Suspense, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useEditor } from "../EditorContext";
import {
  LEAFLET_BG_ID,
  PRESSURE_COLORS,
  REFERENCE_WIDTH,
  clamp,
  round1,
  temperatureColor,
  type MapElement,
  type PressureElement,
} from "../model";
import { TOOLS, isPlacementTool } from "../tools";
import { WeatherIcon } from "../WeatherIcon";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { ElementView } from "./ElementView";
import { Legend } from "./Legend";

// Leaflet n'est chargé que si on ouvre la carte interactive
const LeafletPicker = lazy(() => import("./LeafletPicker").then((m) => ({ default: m.LeafletPicker })));

type Point = { x: number; y: number };

/** Geste en cours (entre pointerdown et pointerup) */
type Interaction =
  | { type: "drag"; ids: string[]; start: Point; origin: Record<string, Point> }
  | { type: "resize"; ids: string[]; startX: number; initial: Record<string, number> }
  | { type: "resize-pressure"; id: string }
  | { type: "draw"; zone: PressureElement["zone"]; center: Point }
  | { type: "marquee"; start: Point; base: string[] }
  | { type: "legend"; start: Point; origin: Point };

const DEFAULT_PRESSURE_RADIUS = 6;

/** Zone centrale : ajuste la carte à l'espace disponible en gardant ses proportions */
export function StageArea() {
  const { doc, tool, setTool } = useEditor();
  const areaRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const aspect = doc.background.aspect;

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const fit = () => {
      const pad = window.innerWidth < 640 ? 12 : 32;
      const w = area.clientWidth - pad * 2;
      const h = area.clientHeight - pad * 2 - 64; // place pour la palette flottante
      const width = Math.max(0, Math.min(w, h * aspect));
      setBox({ width, height: width / aspect });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(area);
    return () => ro.disconnect();
  }, [aspect]);

  const hint = TOOLS.find((t) => t.id === tool)?.hint;

  return (
    <div ref={areaRef} className="bg-canvas-dots relative flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-hidden">
      {hint && (
        <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 animate-pop-in items-center gap-2 rounded-full border bg-surface py-1 pr-1 pl-4 text-sm shadow-md">
          <span>{hint}</span>
          {isPlacementTool(tool) && (
            <span className="hidden items-center gap-1 text-muted-foreground md:flex">
              · <Kbd>Maj</Kbd>+clic pour en placer plusieurs
            </span>
          )}
          <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => setTool("select")} aria-label="Annuler">
            <X />
          </Button>
        </div>
      )}
      <div className="mt-3 sm:mt-8">{box.width > 0 && <Stage width={box.width} height={box.height} />}</div>
    </div>
  );
}

function Stage({ width, height }: { width: number; height: number }) {
  const editor = useEditor();
  const { doc, tool, selectedIds, stageRef, exporting } = editor;
  const scale = width / REFERENCE_WIDTH;

  const interaction = useRef<Interaction | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [drawing, setDrawing] = useState<{ zone: PressureElement["zone"]; center: Point; r: number } | null>(null);
  const [marquee, setMarquee] = useState<{ a: Point; b: Point } | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const byId = (id: string) => doc.elements.find((e) => e.id === id);

  function toPct(e: { clientX: number; clientY: number }): Point {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  /** Distance en % de la largeur (unité des rayons de pression) */
  function radiusBetween(a: Point, b: Point) {
    const dx = b.x - a.x;
    const dy = ((b.y - a.y) * height) / width;
    return Math.hypot(dx, dy);
  }

  function capture(e: ReactPointerEvent, it: Interaction) {
    interaction.current = it;
    try {
      stageRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // pointeur déjà relâché : le geste continue sans capture
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-leaflet]")) return;
    const p = toPct(e);

    if (isPlacementTool(tool)) {
      editor.addElementAt(tool, p.x, p.y);
      if (!e.shiftKey) editor.setTool("select");
      return;
    }
    if (tool === "anticyclone" || tool === "depression") {
      setDrawing({ zone: tool, center: p, r: 0 });
      capture(e, { type: "draw", zone: tool, center: p });
      return;
    }

    const handleId = target.closest<HTMLElement>("[data-handle]")?.dataset.handle;
    if (handleId) {
      const el = byId(handleId);
      if (!el) return;
      if (el.kind === "pressure" && selectedIds.length === 1) {
        capture(e, { type: "resize-pressure", id: el.id });
        return;
      }
      const ids = selectedIds.filter((id) => !byId(id)?.locked);
      const initial: Record<string, number> = {};
      for (const id of ids) {
        const x = byId(id)!;
        initial[id] = x.kind === "icon" ? x.size : x.kind === "pressure" ? x.radius : x.fontSize;
      }
      capture(e, { type: "resize", ids, startX: p.x, initial });
      return;
    }

    if (target.closest("[data-legend]")) {
      capture(e, { type: "legend", start: p, origin: { x: doc.legend.x, y: doc.legend.y } });
      return;
    }

    const elementId = target.closest<HTMLElement>("[data-element-id]")?.dataset.elementId;
    if (elementId) {
      let next: string[];
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        next = selectedIds.includes(elementId) ? selectedIds.filter((id) => id !== elementId) : [...selectedIds, elementId];
      } else {
        next = selectedIds.includes(elementId) ? selectedIds : [elementId];
      }
      editor.setSelectedIds(next);
      const movable = next.map(byId).filter((x): x is MapElement => !!x && !x.locked);
      if (movable.length && next.includes(elementId)) {
        const origin = Object.fromEntries(movable.map((m) => [m.id, { x: m.x, y: m.y }]));
        capture(e, { type: "drag", ids: movable.map((m) => m.id), start: p, origin });
      }
      return;
    }

    // Clic dans le vide : rectangle de sélection
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const base = additive ? selectedIds : [];
    if (!additive) editor.setSelectedIds([]);
    setMarquee({ a: p, b: p });
    capture(e, { type: "marquee", start: p, base });
  }

  function onPointerMove(e: ReactPointerEvent) {
    const p = toPct(e);
    if (isPlacementTool(tool)) setHover(p);
    const it = interaction.current;
    if (!it) return;

    switch (it.type) {
      case "drag": {
        const dx = p.x - it.start.x;
        const dy = p.y - it.start.y;
        editor.updateElements(
          it.ids,
          (el) => ({ ...el, x: clamp(it.origin[el.id].x + dx, 0, 100), y: clamp(it.origin[el.id].y + dy, 0, 100) }),
          { preview: true },
        );
        break;
      }
      case "resize": {
        // Déplacement horizontal converti dans l'unité de référence (carte de 1000 px)
        const delta = (((p.x - it.startX) / 100) * width) / scale;
        editor.updateElements(
          it.ids,
          (el) => {
            const init = it.initial[el.id];
            if (el.kind === "icon") return { ...el, size: round1(clamp(init + delta * 0.8, 16, 240)) };
            if (el.kind === "pressure") return { ...el, radius: round1(clamp(init + (p.x - it.startX), 2, 50)) };
            return { ...el, fontSize: round1(clamp(init + delta * 0.4, 8, 120)) };
          },
          { preview: true },
        );
        break;
      }
      case "resize-pressure": {
        const el = byId(it.id);
        if (el) editor.updateElements([it.id], { radius: round1(clamp(radiusBetween(el, p), 2, 50)) }, { preview: true });
        break;
      }
      case "draw":
        setDrawing({ zone: it.zone, center: it.center, r: radiusBetween(it.center, p) });
        break;
      case "marquee":
        setMarquee({ a: it.start, b: p });
        break;
      case "legend":
        editor.updateLegend(
          { x: clamp(it.origin.x + p.x - it.start.x, 0, 95), y: clamp(it.origin.y + p.y - it.start.y, 0, 95) },
          { preview: true },
        );
        break;
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    const it = interaction.current;
    interaction.current = null;
    if (!it) return;

    switch (it.type) {
      case "drag":
      case "resize-pressure":
      case "legend":
        editor.commitPreview();
        break;
      case "resize": {
        editor.commitPreview();
        // Mémorise la dernière taille de texte utilisée pour les prochains éléments
        if (it.ids.length === 1) {
          const el = byId(it.ids[0]);
          if (el && (el.kind === "label" || el.kind === "temp" || el.kind === "wind")) editor.rememberTextSize(el.kind, el.fontSize);
        }
        break;
      }
      case "draw": {
        const r = radiusBetween(it.center, toPct(e));
        editor.addPressure(it.zone, it.center.x, it.center.y, round1(r < 1.5 ? DEFAULT_PRESSURE_RADIUS : clamp(r, 2, 50)));
        setDrawing(null);
        editor.setTool("select");
        break;
      }
      case "marquee": {
        const box = marquee;
        setMarquee(null);
        if (!box) break;
        const [x0, x1] = [Math.min(box.a.x, box.b.x), Math.max(box.a.x, box.b.x)];
        const [y0, y1] = [Math.min(box.a.y, box.b.y), Math.max(box.a.y, box.b.y)];
        if (x1 - x0 < 0.3 && y1 - y0 < 0.3) break;
        const inside = doc.elements.filter((el) => el.x >= x0 && el.x <= x1 && el.y >= y0 && el.y <= y1).map((el) => el.id);
        editor.setSelectedIds([...new Set([...it.base, ...inside])]);
        break;
      }
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if ((e.target as HTMLElement).closest("[data-leaflet]")) return;
    if (tool !== "select") {
      editor.setTool("select");
      return;
    }
    const elementId = (e.target as HTMLElement).closest<HTMLElement>("[data-element-id]")?.dataset.elementId;
    let targetIds: string[] = [];
    if (elementId) {
      targetIds = selectedIds.includes(elementId) ? selectedIds : [elementId];
      editor.setSelectedIds(targetIds);
    }
    setMenu({ clientX: e.clientX, clientY: e.clientY, at: toPct(e), targetIds });
  }

  function onDoubleClick(e: React.MouseEvent) {
    const elementId = (e.target as HTMLElement).closest<HTMLElement>("[data-element-id]")?.dataset.elementId;
    if (elementId) {
      editor.setSelectedIds([elementId]);
      editor.requestFocus(elementId);
    }
  }

  const isLeaflet = doc.background.id === LEAFLET_BG_ID;
  const crosshair = tool !== "select";

  return (
    <>
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onContextMenu={onContextMenu}
        onDoubleClick={onDoubleClick}
        className="relative touch-none overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgb(15_23_42/0.08),0_12px_40px_-12px_rgb(15_23_42/0.25)] select-none"
        style={{ width, height, cursor: crosshair ? "crosshair" : "default" }}
      >
        {isLeaflet ? (
          <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-slate-100" />}>
            <LeafletPicker
              onCapture={editor.captureInteractiveMap}
              onError={() => editor.notify("La capture a échoué. Vérifie ta connexion internet.", "error")}
            />
          </Suspense>
        ) : (
          doc.background.url && (
            <img src={doc.background.url} alt="" className="pointer-events-none absolute inset-0 size-full object-fill" draggable={false} />
          )
        )}

        {doc.elements.map((el) => (
          <ElementView
            key={el.id}
            el={el}
            scale={scale}
            stageWidth={width}
            customIcons={doc.customIcons}
            selected={selectedIds.includes(el.id)}
            showChrome={!exporting}
          />
        ))}

        <Legend doc={doc} scale={scale} />

        {hover && isPlacementTool(tool) && <Ghost at={hover} scale={scale} />}

        {drawing && (
          <div
            className="pointer-events-none absolute rounded-full border-2"
            style={{
              left: `${drawing.center.x}%`,
              top: `${drawing.center.y}%`,
              width: (drawing.r / 100) * width * 2,
              height: (drawing.r / 100) * width * 2,
              transform: "translate(-50%, -50%)",
              borderColor: PRESSURE_COLORS[drawing.zone].stroke,
              background: PRESSURE_COLORS[drawing.zone].fill,
            }}
          />
        )}

        {marquee && (
          <div
            className="pointer-events-none absolute border border-selection bg-selection/10"
            style={{
              left: `${Math.min(marquee.a.x, marquee.b.x)}%`,
              top: `${Math.min(marquee.a.y, marquee.b.y)}%`,
              width: `${Math.abs(marquee.b.x - marquee.a.x)}%`,
              height: `${Math.abs(marquee.b.y - marquee.a.y)}%`,
            }}
          />
        )}
      </div>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </>
  );
}

/** Aperçu semi-transparent de l'élément avant de le poser */
function Ghost({ at, scale }: { at: Point; scale: number }) {
  const { tool, iconId, doc } = useEditor();
  const fontSize = 20 * scale;
  let content: React.ReactNode = null;
  if (tool === "icon") content = <WeatherIcon iconId={iconId} customIcons={doc.customIcons} size={48 * scale} />;
  else if (tool === "label") content = <span className="text-halo font-bold text-slate-900" style={{ fontSize }}>Ville</span>;
  else if (tool === "temp")
    content = (
      <span
        className="rounded-full border-2 border-white px-2 font-extrabold text-white"
        style={{ fontSize, background: temperatureColor("25") }}
      >
        25°C
      </span>
    );
  else if (tool === "wind")
    content = (
      <span className="text-halo inline-flex items-center gap-1 font-bold text-sky-700" style={{ fontSize }}>
        <WeatherIcon iconId="wind" customIcons={[]} size={fontSize * 1.15} /> 50 km/h
      </span>
    );
  return (
    <div
      className="pointer-events-none absolute opacity-60"
      style={{ left: `${at.x}%`, top: `${at.y}%`, transform: "translate(-50%, -50%)" }}
    >
      {content}
    </div>
  );
}
