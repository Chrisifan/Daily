import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

type DropdownContentProps = ComponentPropsWithoutRef<typeof DropdownMenu.Content>;

export const DropdownContent = forwardRef<HTMLDivElement, DropdownContentProps>(
  function DropdownContent({ align = "start", collisionPadding = 12, side = "bottom", sideOffset = 4, style, ...props }, ref) {
    return (
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          ref={ref}
          align={align}
          collisionPadding={collisionPadding}
          side={side}
          sideOffset={sideOffset}
          sticky="partial"
          style={{
            width: "var(--radix-popper-anchor-width)",
            maxHeight: "min(var(--radix-popper-available-height), 18rem)",
            ...style,
          }}
          {...props}
        />
      </DropdownMenu.Portal>
    );
  },
);
