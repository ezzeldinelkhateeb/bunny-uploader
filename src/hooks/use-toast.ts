import { toast } from "../components/ui/use-toast"

type ToastType = {
  title: string;
  description: string;
  variant?: "default" | "destructive" | "success" | "warning";
  duration?: number;
}

export const showToast = ({ title, description, variant = "default", duration = 5000 }: ToastType) => {
  toast({
    title,
    description,
    variant,
    duration
  });
};
