import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"

function Avatar({ className, size, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root> & { size?: string }) {
  return <AvatarPrimitive.Root data-slot="avatar" data-size={size} className={className} {...props} />
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image data-slot="avatar-image" className={className} {...props} />
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return <AvatarPrimitive.Fallback data-slot="avatar-fallback" className={className} {...props} />
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="avatar-badge" className={className} {...props} />
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="avatar-group" className={className} {...props} />
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="avatar-group-count" className={className} {...props} />
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge }
