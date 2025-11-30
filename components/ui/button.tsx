import * as React from "react"
import { cn } from "@/lib/utils"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const buttonVariants = ({ variant = 'default', size = 'default' }: { variant?: ButtonProps['variant'], size?: ButtonProps['size'] } = {}) => {
  const baseStyles =
    "inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 backdrop-blur"

  const variants = {
    default:
      "bg-gradient-to-br from-[#f7dfa1] via-[#d9a441] to-[#b9782c] text-[#120c06] shadow-[0_15px_45px_rgba(0,0,0,0.45)] hover:brightness-110 hover:-translate-y-[1px] active:translate-y-0 ring-offset-background",
    destructive:
      "bg-gradient-to-br from-[#e75d48] to-[#8a1f13] text-white shadow-[0_12px_32px_rgba(231,93,72,0.35)] hover:brightness-105 ring-offset-background",
    outline:
      "border border-[rgba(243,213,128,0.25)] bg-transparent text-foreground hover:bg-[rgba(243,213,128,0.08)] hover:border-[rgba(243,213,128,0.4)]",
    secondary:
      "border border-[rgba(243,213,128,0.22)] bg-[rgba(27,20,15,0.75)] text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:border-[rgba(243,213,128,0.45)]",
    ghost:
      "text-foreground hover:bg-[rgba(243,213,128,0.08)] hover:text-foreground/90",
    link: "text-[#f3d580] underline-offset-4 hover:underline",
  }

  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  }

  return cn(baseStyles, variants[variant], sizes[size])
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }
