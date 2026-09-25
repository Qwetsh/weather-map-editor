import { PRESSURE_COLORS, PRESSURE_SHORT_LABEL_RADIUS, type PressureElement } from "../model";

const ARROW_ANGLES = [0, 60, 120, 180, 240, 300];
const ARC_RADIUS = 35;
const ARC_SPAN = 25;

/**
 * Anticyclone / dépression : disque coloré avec des flèches qui tournent.
 * Hémisphère Nord : anticyclone horaire, dépression antihoraire (inversé au Sud).
 */
export function PressureZone({ el, stageWidth }: { el: PressureElement; stageWidth: number }) {
  const size = (el.radius / 100) * stageWidth * 2;
  const isAnticyclone = el.zone === "anticyclone";
  const { stroke, fill } = PRESSURE_COLORS[el.zone];
  const clockwise = (el.hemisphere ?? "North") === "North" ? isAnticyclone : !isAnticyclone;
  const short = el.radius < PRESSURE_SHORT_LABEL_RADIUS;
  const label = short ? (isAnticyclone ? "A" : "D") : isAnticyclone ? "Anticyclone" : "Dépression";
  const markerId = `arrow-${el.id}`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{ background: fill, border: `2px solid ${stroke}` }} />
      <svg
        viewBox="0 0 100 100"
        className="pressure-rotor absolute inset-0 size-full"
        style={{
          animation: "pressure-spin 22s linear infinite",
          animationDirection: clockwise ? "normal" : "reverse",
        }}
      >
        <defs>
          <marker id={markerId} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill={stroke} />
          </marker>
        </defs>
        <g stroke={stroke} fill="none" strokeWidth="2.5" strokeLinecap="round">
          {ARROW_ANGLES.map((angle) => {
            const start = ((angle - (clockwise ? ARC_SPAN : -ARC_SPAN)) * Math.PI) / 180;
            const end = ((angle + (clockwise ? ARC_SPAN : -ARC_SPAN)) * Math.PI) / 180;
            const x1 = 50 + ARC_RADIUS * Math.cos(start);
            const y1 = 50 + ARC_RADIUS * Math.sin(start);
            const x2 = 50 + ARC_RADIUS * Math.cos(end);
            const y2 = 50 + ARC_RADIUS * Math.sin(end);
            const d = `M ${x1} ${y1} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 ${clockwise ? 1 : 0} ${x2} ${y2}`;
            return <path key={angle} d={d} markerEnd={`url(#${markerId})`} />;
          })}
        </g>
      </svg>
      <div
        className="text-halo absolute inset-0 flex items-center justify-center text-center font-bold"
        style={{ color: stroke, fontSize: short ? Math.max(12, size * 0.32) : Math.max(11, size * 0.1) }}
      >
        {label}
      </div>
    </div>
  );
}
