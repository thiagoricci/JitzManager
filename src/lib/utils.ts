import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Student avatar circles use a single neutral gray (theme-aware) rather than a
// per-name color, to keep the lists/profile visually calm.
export function getAvatarColor(_name: string): string {
  return "bg-muted text-muted-foreground";
}
