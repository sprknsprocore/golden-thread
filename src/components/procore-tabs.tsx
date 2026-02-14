"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { useProductionStore } from "@/store/use-production-store";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Budget", completionKey: null },
  { href: "/setup", label: "Setup", completionKey: "setup" as const },
  { href: "/work-package", label: "Work Package", completionKey: null },
  { href: "/capture", label: "Capture", completionKey: "capture" as const },
  { href: "/reconciliation", label: "True-Up", completionKey: "trueUp" as const },
  { href: "/analysis", label: "Analysis", completionKey: null },
  { href: "/closeout", label: "Closeout", completionKey: "closeout" as const },
];

type CompletionKey = "setup" | "capture" | "trueUp" | "closeout";

function useWorkflowCompletion(): Record<CompletionKey, boolean> {
  const { provisionalCodes, productionEvents, trueUpStatuses, estimatingDatabase } =
    useProductionStore();

  // True-Up is complete when at least one code has been reviewed
  const hasReviewed = Object.values(trueUpStatuses).some(
    (s) => s !== "pending"
  );

  return {
    setup: provisionalCodes.length > 0,
    capture: productionEvents.length > 0,
    trueUp: hasReviewed,
    closeout: estimatingDatabase.length > 0,
  };
}

interface ProcoreTabsProps {
  /** Optional action slot rendered on the right side of the tab bar */
  actions?: React.ReactNode;
}

export function ProcoreTabs({ actions }: ProcoreTabsProps) {
  const pathname = usePathname();
  const completion = useWorkflowCompletion();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="shrink-0 bg-white border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
      <div className="flex items-center justify-between px-4">
        {/* Tabs */}
        <nav className="flex items-center gap-0 -mb-px">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            const isComplete = tab.completionKey
              ? completion[tab.completionKey]
              : false;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5",
                  active
                    ? "font-semibold"
                    : "hover:text-foreground"
                )}
                style={{
                  color: active
                    ? "var(--figma-text-primary)"
                    : "var(--figma-text-tertiary)",
                }}
              >
                {tab.label}
                {isComplete && !active && (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                )}
                {isComplete && active && (
                  <Check className="h-3.5 w-3.5 text-figma-orange" />
                )}
                {/* Active underline */}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-figma-orange" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right action slot */}
        {actions && (
          <div className="flex items-center gap-2 py-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
