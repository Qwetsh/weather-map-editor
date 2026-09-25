import type { ReactNode } from "react";
import { findIcon, type CustomIcon } from "./model";

/**
 * Pictos météo dessinés en SVG (grille 64×64) : rendu identique sur tous les
 * appareils et à l'export PNG, contrairement aux emojis.
 */

const CLOUD = "M20 46A10 10 0 0 1 18.5 26.2A14 14 0 0 1 44.5 22A12 12 0 0 1 46 46Z";

function Cloud({ fill, stroke, transform }: { fill: string; stroke: string; transform?: string }) {
  return <path d={CLOUD} fill={fill} stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" transform={transform} />;
}

function Sun({ cx = 32, cy = 32, r = 12, ray = [17, 25] }: { cx?: number; cy?: number; r?: number; ray?: [number, number] }) {
  return (
    <g>
      <g stroke="#f59e0b" strokeWidth={r / 3.2} strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const rad = (a * Math.PI) / 180;
          return (
            <line
              key={a}
              x1={cx + ray[0] * Math.cos(rad)}
              y1={cy + ray[0] * Math.sin(rad)}
              x2={cx + ray[1] * Math.cos(rad)}
              y2={cy + ray[1] * Math.sin(rad)}
            />
          );
        })}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="#fbbf24" stroke="#f59e0b" strokeWidth={2.5} />
    </g>
  );
}

const Flake = ({ x, y }: { x: number; y: number }) => (
  <g stroke="#0ea5e9" strokeWidth={2.4} strokeLinecap="round" transform={`translate(${x} ${y})`}>
    <line x1={0} y1={-5} x2={0} y2={5} />
    <line x1={-4.3} y1={-2.5} x2={4.3} y2={2.5} />
    <line x1={-4.3} y1={2.5} x2={4.3} y2={-2.5} />
  </g>
);

const LIGHT_CLOUD = { fill: "#f8fafc", stroke: "#94a3b8" };
const RAIN_CLOUD = { fill: "#e2e8f0", stroke: "#64748b" };

const DRAWINGS: Record<string, ReactNode> = {
  sun: <Sun />,
  partly: (
    <>
      <Sun cx={24} cy={23} r={9} ray={[13, 19]} />
      <Cloud {...LIGHT_CLOUD} transform="translate(9 12) scale(0.86)" />
    </>
  ),
  cloud: (
    <>
      <Cloud fill="#cbd5e1" stroke="#94a3b8" transform="translate(24 3) scale(0.62)" />
      <Cloud {...LIGHT_CLOUD} transform="translate(-2 6)" />
    </>
  ),
  rain: (
    <>
      <Cloud {...RAIN_CLOUD} transform="translate(0 -7)" />
      <g stroke="#2563eb" strokeWidth={3.6} strokeLinecap="round">
        <line x1={23} y1={46} x2={20} y2={54} />
        <line x1={33} y1={46} x2={30} y2={58} />
        <line x1={43} y1={46} x2={40} y2={54} />
      </g>
    </>
  ),
  storm: (
    <>
      <Cloud fill="#64748b" stroke="#334155" transform="translate(0 -8)" />
      <path d="M34 34 25 49h7l-4 12 13-17h-7l4-10Z" fill="#facc15" stroke="#ca8a04" strokeWidth={2} strokeLinejoin="round" />
    </>
  ),
  snow: (
    <>
      <Cloud {...RAIN_CLOUD} transform="translate(0 -8)" />
      <Flake x={21} y={50} />
      <Flake x={33} y={56} />
      <Flake x={45} y={50} />
    </>
  ),
  fog: (
    <>
      <Cloud fill="#e2e8f0" stroke="#94a3b8" transform="translate(4 -10) scale(0.9)" />
      <g stroke="#94a3b8" strokeWidth={4.5} strokeLinecap="round">
        <line x1={10} y1={42} x2={44} y2={42} />
        <line x1={20} y1={50} x2={54} y2={50} />
        <line x1={10} y1={58} x2={36} y2={58} />
        <line x1={44} y1={58} x2={54} y2={58} />
      </g>
    </>
  ),
  wind: (
    <g fill="none" stroke="#0284c7" strokeWidth={4.5} strokeLinecap="round">
      <path d="M8 25h29a7 7 0 1 0-7-7" />
      <path d="M8 36h39a7 7 0 1 1-7 7" />
      <path d="M8 47h20" />
    </g>
  ),
  hot: (
    <>
      <g fill="none" stroke="#f97316" strokeWidth={3} strokeLinecap="round">
        <path d="M48 12q4 4 0 8t0 8" />
        <path d="M16 12q4 4 0 8t0 8" />
      </g>
      <rect x={25} y={6} width={14} height={40} rx={7} fill="#fff" stroke="#b91c1c" strokeWidth={2.5} />
      <circle cx={32} cy={48} r={10} fill="#ef4444" stroke="#b91c1c" strokeWidth={2.5} />
      <rect x={29} y={16} width={6} height={30} rx={3} fill="#ef4444" />
    </>
  ),
  drought: (
    <>
      <Sun cx={32} cy={20} r={8} ray={[12, 17]} />
      <rect x={5} y={40} width={54} height={18} rx={4} fill="#d97706" stroke="#92400e" strokeWidth={2.5} />
      <path d="M18 40l4 6-3 5 3 7M38 40l-3 5 5 4-2 9M50 44l-5 3" fill="none" stroke="#78350f" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </>
  ),
  wildfire: (
    <>
      <path
        d="M32 4c6 10 18 17 17 33-1 12-9 21-17 21S15 51 15 39c0-9 5-15 9-21 1 7 4 10 6 11 0-8-1-16 2-25Z"
        fill="#f97316"
        stroke="#c2410c"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d="M32 29c4 6 9 10 8 17-1 6-4 9-8 9s-8-3-8-9c0-5 4-8 5-12 1 3 2 4 3 5 0-4-1-7 0-10Z" fill="#fde047" />
    </>
  ),
  flood: (
    <>
      <path d="M13 31 32 14l19 17" fill="#f97316" stroke="#9a3412" strokeWidth={2.5} strokeLinejoin="round" />
      <rect x={18} y={29} width={28} height={16} fill="#fde68a" stroke="#92400e" strokeWidth={2.5} />
      <path d="M4 42q7-6 14 0t14 0 14 0 14 0v18H4Z" fill="#60a5fa" />
      <path d="M4 50q7-6 14 0t14 0 14 0 14 0v10H4Z" fill="#2563eb" />
    </>
  ),
  cyclone: (
    <g fill="#6366f1" stroke="#4338ca" strokeWidth={2} strokeLinejoin="round">
      <path d="M24 31C22 17 34 6 52 7 41 11 37 18 39 29Z" />
      <path d="M24 31C22 17 34 6 52 7 41 11 37 18 39 29Z" transform="rotate(180 32 32)" />
      <circle cx={32} cy={32} r={10} />
      <circle cx={32} cy={32} r={4} fill="#fff" stroke="none" />
    </g>
  ),
};

type WeatherIconProps = {
  iconId: string;
  customIcons: CustomIcon[];
  size: number;
  className?: string;
};

export function WeatherIcon({ iconId, customIcons, size, className }: WeatherIconProps) {
  const drawing = DRAWINGS[iconId];
  if (drawing) {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
        {drawing}
      </svg>
    );
  }
  const icon = findIcon(iconId, customIcons);
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ fontSize: size * 0.82, lineHeight: 1, width: size, height: size, display: "inline-grid", placeItems: "center" }}
    >
      {icon.glyph}
    </span>
  );
}
