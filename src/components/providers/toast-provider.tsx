import {
  ToastProvider as RadixToastProvider,
  ToastViewport,
} from "@/components/ui/toast"

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <RadixToastProvider>
      {children}
      <ToastViewport />
    </RadixToastProvider>
  )
}
