import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Remove the circular import
// import { cn } from "@/lib/utils";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
