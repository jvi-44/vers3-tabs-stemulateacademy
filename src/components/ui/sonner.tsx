"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// The sticker look for toasts lives in styles/ui-pop.css, so it also covers
// screens that import <Toaster> from "sonner" directly.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      gap={14}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--ink-line)",
          "--border-radius": "1.3rem",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
