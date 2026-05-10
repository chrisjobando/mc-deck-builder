import * as React from "react"

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & { variant?: string }) {
  return <div data-slot="alert" role="alert" data-variant={variant} className={className} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={className} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={className} {...props} />
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-action" className={className} {...props} />
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
