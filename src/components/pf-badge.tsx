import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Unified Performance Factor badge with consistent thresholds:
 *   Green  >= 1.00  (winning)
 *   Amber  >= 0.85  (at risk)
 *   Red    <  0.85  (losing)
 */
interface PFBadgeProps {
  pf: number;
  hasData: boolean;
  /** Show "PF" label prefix (default: false) */
  showLabel?: boolean;
  /** Claiming progress is stale — most recent event has no claiming data */
  isStale?: boolean;
  className?: string;
}

export function PFBadge({ pf, hasData, showLabel = false, isStale = false, className }: PFBadgeProps) {
  if (!hasData) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] font-mono px-1.5",
          pf >= 1
            ? "border-green-500 text-green-700 bg-green-50"
            : pf >= 0.85
            ? "border-amber-500 text-amber-700 bg-amber-50"
            : "border-red-500 text-red-700 bg-red-50",
          className
        )}
      >
        {showLabel && "PF "}
        {pf === Infinity ? "∞" : pf.toFixed(2)}
      </Badge>
      {isStale && (
        <span
          className="inline-block h-2 w-2 rounded-full bg-amber-400 shrink-0"
          title="Claiming progress may be outdated — last entry had no claiming data"
        />
      )}
    </span>
  );
}
