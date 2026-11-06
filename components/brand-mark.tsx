import { FileText, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <FileText className="h-[18px] w-[18px]" strokeWidth={2.2} />
      <MessageCircle className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background p-[2px] text-primary" strokeWidth={2.5} />
    </span>
  );
}
