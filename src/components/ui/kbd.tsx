import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/20 px-1 font-sans text-[11px] font-medium opacity-80",
        className,
      )}
      {...props}
    />
  );
}
