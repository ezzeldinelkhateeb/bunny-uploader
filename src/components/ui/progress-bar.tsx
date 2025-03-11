import * as React from "react"
import { Progress } from "@/components/ui/progress"

interface ProgressBarProps {
  value: number;
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  return <Progress value={value} className={className} />
}
