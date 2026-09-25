import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-b px-4 py-4 last:border-b-0">
      {title && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, htmlFor, value, children }: { label: string; htmlFor?: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <label htmlFor={htmlFor} className="font-medium">
          {label}
        </label>
        {value !== undefined && <span className="text-muted-foreground tabular-nums">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label} value={`${Math.round(value)}${unit}`}>
      <Slider value={[value]} min={min} max={max} step={step} disabled={disabled} onValueChange={([v]) => onChange(v)} />
    </Field>
  );
}

type SegmentedOption<T extends string> = { value: T; label: ReactNode };

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-7 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
            value === o.value && "bg-surface text-foreground shadow-sm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-3 text-[13px] font-medium", disabled && "opacity-40")}>
      {label}
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </button>
    </label>
  );
}

const SWATCHES = ["#0f172a", "#ffffff", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#2563eb", "#7c3aed"];

export function ColorField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Field label="Couleur">
      <div className="flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            disabled={disabled}
            aria-label={`Couleur ${c}`}
            onClick={() => onChange(c)}
            className={cn(
              "size-6 rounded-full border border-black/10 shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40",
              value.toLowerCase() === c && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
            )}
            style={{ background: c }}
          />
        ))}
        <label
          className="relative size-6 cursor-pointer overflow-hidden rounded-full border border-black/10 shadow-xs"
          style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
          title="Autre couleur"
        >
          <input
            type="color"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </Field>
  );
}
