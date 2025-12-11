import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { ReactNode } from "react";

interface GradientCardProps {
  children: ReactNode;
  className?: string;
  gradient?: 'gold' | 'success' | 'primary' | 'glass' | 'none';
  glow?: boolean;
  hover?: boolean;
}

const gradientStyles = {
  gold: "before:absolute before:inset-0 before:bg-gradient-to-br before:from-gold/10 before:via-transparent before:to-gold/5 before:rounded-xl before:pointer-events-none",
  success: "before:absolute before:inset-0 before:bg-gradient-to-br before:from-success/10 before:via-transparent before:to-success/5 before:rounded-xl before:pointer-events-none",
  primary: "before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/10 before:via-transparent before:to-primary/5 before:rounded-xl before:pointer-events-none",
  glass: "bg-card/80 backdrop-blur-md border-border/40",
  none: "",
};

const glowStyles = {
  gold: "after:absolute after:-inset-[1px] after:bg-gradient-to-r after:from-gold/20 after:via-gold/40 after:to-gold/20 after:rounded-xl after:blur-xl after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-500 after:-z-10",
  success: "after:absolute after:-inset-[1px] after:bg-gradient-to-r after:from-success/20 after:via-success/40 after:to-success/20 after:rounded-xl after:blur-xl after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-500 after:-z-10",
  primary: "after:absolute after:-inset-[1px] after:bg-gradient-to-r after:from-primary/20 after:via-primary/40 after:to-primary/20 after:rounded-xl after:blur-xl after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-500 after:-z-10",
  glass: "",
  none: "",
};

export function GradientCard({ 
  children, 
  className,
  gradient = 'none',
  glow = false,
  hover = true
}: GradientCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300",
      hover && "hover:shadow-card-hover hover:-translate-y-0.5",
      gradient !== 'none' && gradientStyles[gradient],
      glow && glowStyles[gradient],
      className
    )}>
      {children}
    </Card>
  );
}

export { CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
