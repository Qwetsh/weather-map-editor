// Styles partagés avec le menu contextuel de la carte
export const menuPanelClass = "min-w-52 animate-pop-in rounded-xl border bg-surface p-1 text-foreground shadow-xl";
export const menuItemClass =
  "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm outline-none select-none hover:bg-surface-2 focus-visible:bg-surface-2 data-disabled:pointer-events-none data-disabled:opacity-40 data-highlighted:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
export const menuItemDestructiveClass =
  "text-destructive hover:bg-destructive/10 data-highlighted:bg-destructive/10 [&_svg]:text-destructive";
export const menuItemSelectedClass =
  "bg-primary-soft text-primary-soft-foreground [&_svg]:text-primary-soft-foreground";
export const menuLabelClass = "px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground";
export const menuSeparatorClass = "mx-1 my-1 h-px bg-border";
