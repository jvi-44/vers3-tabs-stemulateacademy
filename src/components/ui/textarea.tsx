import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "pop-field resize-none flex field-sizing-content min-h-20 w-full px-3.5 py-2.5 text-base md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
