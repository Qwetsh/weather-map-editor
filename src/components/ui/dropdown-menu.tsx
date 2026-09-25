import * as React from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import {
  menuItemClass,
  menuPanelClass,
  menuItemDestructiveClass,
  menuItemSelectedClass,
  menuLabelClass,
  menuSeparatorClass,
} from "./menu-styles";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 outline-none", menuPanelClass,
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

type ItemProps = React.ComponentProps<typeof Menu.Item> & {
  icon?: React.ReactNode;
  shortcut?: string;
  destructive?: boolean;
  selected?: boolean;
};

export function DropdownMenuItem({ className, icon, shortcut, destructive, selected, children, ...props }: ItemProps) {
  return (
    <Menu.Item
      className={cn(menuItemClass, destructive && menuItemDestructiveClass, selected && menuItemSelectedClass, className)}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
    </Menu.Item>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn(menuLabelClass, className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn(menuSeparatorClass, className)} {...props} />;
}
