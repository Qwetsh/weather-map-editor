import type { CSSProperties } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTemperature, temperatureColor, type CustomIcon, type MapElement, type TextElement } from "../model";
import { WeatherIcon } from "../WeatherIcon";
import { PressureZone } from "./PressureZone";

type Props = {
  el: MapElement;
  scale: number;
  stageWidth: number;
  customIcons: CustomIcon[];
  selected: boolean;
  /** false pendant l'export PNG */
  showChrome: boolean;
};

export function ElementView({ el, scale, stageWidth, customIcons, selected, showChrome }: Props) {
  const framed = selected && showChrome;
  return (
    <div
      data-element-id={el.id}
      className="absolute touch-none select-none"
      style={{
        left: `${el.x}%`,
        top: `${el.y}%`,
        transform: "translate(-50%, -50%)",
        cursor: el.locked ? "default" : "move",
      }}
    >
      <ElementContent el={el} scale={scale} stageWidth={stageWidth} customIcons={customIcons} />
      {framed && (
        <div
          className={cn(
            "pointer-events-none absolute -inset-1 outline-2 outline-selection",
            el.kind === "pressure" ? "rounded-full outline-dashed" : "rounded-md",
            el.locked && "outline-dashed",
          )}
        >
          {el.locked ? (
            <span className="absolute -top-2.5 -right-2.5 grid size-5 place-items-center rounded-full bg-selection text-white shadow">
              <Lock className="size-3" />
            </span>
          ) : (
            <span
              data-handle={el.id}
              title="Redimensionner"
              className="pointer-events-auto absolute top-1/2 -right-1.5 size-3 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-selection bg-white shadow"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ElementContent({ el, scale, stageWidth, customIcons }: Omit<Props, "selected" | "showChrome">) {
  switch (el.kind) {
    case "pressure":
      return <PressureZone el={el} stageWidth={stageWidth} />;
    case "icon":
      return (
        <WeatherIcon
          iconId={el.iconId}
          customIcons={customIcons}
          size={el.size * scale}
          className="block drop-shadow-[0_1px_1.5px_rgb(15_23_42_/_0.35)]"
        />
      );
    case "temp":
      if (el.colorMode === "auto") {
        return (
          <div
            className="rounded-full font-extrabold whitespace-nowrap text-white"
            style={{
              fontSize: el.fontSize * scale,
              background: temperatureColor(el.value),
              padding: "0.12em 0.55em",
              border: `${Math.max(1.5, 2 * scale)}px solid white`,
              boxShadow: "0 2px 6px rgb(15 23 42 / 0.3)",
            }}
          >
            {formatTemperature(el.value)}
          </div>
        );
      }
      return <TextBox el={el} scale={scale} weight={800}>{formatTemperature(el.value)}</TextBox>;
    case "wind":
      return (
        <TextBox el={el} scale={scale} weight={700} className="inline-flex items-center gap-[0.25em]">
          <WeatherIcon iconId="wind" customIcons={customIcons} size={el.fontSize * scale * 1.15} />
          {el.speedKmh} km/h
        </TextBox>
      );
    case "label":
      return <TextBox el={el} scale={scale} weight={700}>{el.text || " "}</TextBox>;
  }
}

type TextBoxProps = {
  el: TextElement;
  scale: number;
  weight: number;
  className?: string;
  children: React.ReactNode;
};

function TextBox({ el, scale, weight, className, children }: TextBoxProps) {
  const style: CSSProperties = {
    color: el.color,
    fontSize: el.fontSize * scale,
    fontWeight: weight,
    padding: "0.1em 0.4em",
    lineHeight: 1.25,
  };
  if (el.bg) style.background = "rgb(255 255 255 / 0.92)";
  if (el.border) {
    style.border = "1px solid rgb(148 163 184)";
    style.boxShadow = "0 1px 3px rgb(15 23 42 / 0.15)";
  }
  return (
    <div className={cn("rounded-lg whitespace-nowrap", !el.bg && "text-halo", className)} style={style}>
      {children}
    </div>
  );
}
