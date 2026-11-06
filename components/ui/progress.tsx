import { cn } from "@/lib/utils";

type ProgressProps = {
  /** 0 to 100. Leave undefined for an indeterminate bar. */
  value?: number;
  label: string;
  className?: string;
  indicatorClassName?: string;
};

export function Progress({ value, label, className, indicatorClassName }: ProgressProps) {
  const indeterminate = value === undefined;
  const progress = indeterminate ? 0 : Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(progress)}
      aria-valuetext={indeterminate ? "In progress" : `${Math.round(progress)}%`}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary",
          indeterminate ? "w-2/5 animate-indeterminate" : "transition-[width] duration-200",
          indicatorClassName,
        )}
        style={indeterminate ? undefined : { width: `${progress}%` }}
      />
    </div>
  );
}
