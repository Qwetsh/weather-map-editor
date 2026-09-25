import { cn } from "@/lib/utils";

export function PressureDot({ zone, className }: { zone: "A" | "D"; className?: string }) {
  const color = zone === "A" ? "var(--anticyclone)" : "var(--depression)";
  return (
    <span
      className={cn("grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] text-[9px] font-bold", className)}
      style={{ color, borderColor: color, background: `color-mix(in oklab, ${color} 15%, transparent)` }}
    >
      {zone}
    </span>
  );
}
