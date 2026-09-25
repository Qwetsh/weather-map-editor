import type { ReactNode } from "react";
import { MapPin, MousePointer2, Thermometer, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { useEditor } from "../EditorContext";
import { PressureDot } from "../PressureDot";
import { TOOLS, type Tool } from "../tools";
import { WeatherIcon } from "../WeatherIcon";

export function Toolbar() {
  const { tool, setTool, iconId, doc } = useEditor();

  const visuals: Record<Tool, ReactNode> = {
    select: <MousePointer2 />,
    icon: <WeatherIcon iconId={iconId} customIcons={doc.customIcons} size={24} />,
    label: <MapPin />,
    temp: <Thermometer />,
    wind: <Wind />,
    anticyclone: <PressureDot zone="A" className="size-5 text-[11px]" />,
    depression: <PressureDot zone="D" className="size-5 text-[11px]" />,
  };

  return (
    <nav
      aria-label="Outils"
      className="flex shrink-0 gap-1 overflow-x-auto border-b bg-surface p-1.5 md:w-16 md:flex-col md:items-center md:overflow-visible md:border-r md:border-b-0 md:py-3"
    >
      {TOOLS.map((t, i) => (
        <div key={t.id} className="contents">
          {(i === 1 || i === 5) && <div className="mx-1 h-8 w-px shrink-0 self-center bg-border md:mx-0 md:my-1 md:h-px md:w-8" />}
          <Tooltip side="right" content={<>{t.label} <Kbd>{t.key}</Kbd></>}>
            <button
              onClick={() => setTool(t.id)}
              aria-label={t.label}
              aria-pressed={tool === t.id}
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring [&_svg]:size-5",
                tool === t.id && "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft hover:text-primary-soft-foreground",
              )}
            >
              {visuals[t.id]}
            </button>
          </Tooltip>
        </div>
      ))}
    </nav>
  );
}
