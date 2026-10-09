import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

// Chunky website buttons: ink outline, hard shadow that squashes on press.
const INKED =
  "border-[2.5px] border-ink shadow-[0_3px_0_var(--ink-line)] hover:-translate-y-0.5 hover:shadow-[0_5px_0_var(--ink-line)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--ink-line)]";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display text-sm font-semibold leading-none cursor-pointer transition-[translate,box-shadow,background-color,color] duration-150 disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-4 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: `${INKED} bg-primary text-primary-foreground`,
        destructive: `${INKED} bg-destructive text-white focus-visible:ring-destructive/30`,
        outline: `${INKED} bg-card text-foreground hover:bg-soft-1`,
        secondary: `${INKED} bg-pop-2 text-[#1b1b12]`,
        ghost: "text-foreground hover:bg-soft-1",
        link: "text-primary underline decoration-2 decoration-wavy underline-offset-4 hover:decoration-pop-2",
      },
      size: {
        default: "h-10 px-5 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 px-3.5 text-[13px] has-[>svg]:px-3",
        lg: "h-12 px-7 text-base has-[>svg]:px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
