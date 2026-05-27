import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './lib/utils' // assuming you have a cn utility, or replace with your own

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl font-semibold transition-all active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-[#0A3D2E] text-white hover:bg-[#C5A26F] hover:text-white focus:ring-[#0A3D2E]",
        outline: "border-2 border-[#0A3D2E] text-[#0A3D2E] hover:bg-[#0A3D2E] hover:text-white focus:ring-[#0A3D2E]",
        ghost: "hover:bg-[#0A3D2E]/10 text-[#0A3D2E]",
      },
      size: {
        default: "px-8 py-4 text-base",
        lg: "px-12 py-6 text-lg",
        xl: "px-16 py-8 text-2xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
