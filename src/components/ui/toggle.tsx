import * as React from "react"
import { Toggle as TogglePrimitive } from "radix-ui"

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & { variant?: string; size?: string }) {
  return <TogglePrimitive.Root data-slot="toggle" className={className} {...props} />
}

export { Toggle }
