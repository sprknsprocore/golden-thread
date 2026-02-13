"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Play,
  X,
  Settings,
  ClipboardList,
  GitCompareArrows,
  FlagTriangleRight,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useProductionStore } from "@/store/use-production-store";
import { cn } from "@/lib/utils";

const workflowSteps = [
  {
    key: "setup" as const,
    label: "Setup",
    href: "/setup",
    icon: Settings,
    instruction: "Provisional codes are pre-loaded. Review your scope.",
  },
  {
    key: "capture" as const,
    label: "Capture",
    href: "/capture",
    icon: ClipboardList,
    instruction: "See Mon-Wed data in the grid. Add Thu-Fri entries.",
  },
  {
    key: "trueUp" as const,
    label: "True-Up",
    href: "/reconciliation",
    icon: GitCompareArrows,
    instruction: "30\" RCP is adjusted. Accept, adjust, or flag the remaining codes.",
  },
  {
    key: "closeout" as const,
    label: "Closeout",
    href: "/closeout",
    icon: FlagTriangleRight,
    instruction: "Compare rates and push to estimating database.",
  },
];

type StepKey = "setup" | "capture" | "trueUp" | "closeout";

function useStepCompletion(): Record<StepKey, boolean> {
  const { provisionalCodes, productionEvents, trueUpStatuses, estimatingDatabase } =
    useProductionStore();

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

function getActiveStep(pathname: string): StepKey | null {
  if (pathname === "/setup") return "setup";
  if (pathname === "/capture") return "capture";
  if (pathname === "/reconciliation") return "trueUp";
  if (pathname === "/closeout") return "closeout";
  return null;
}

export function DemoBanner() {
  const { productionEvents, seedDemoScenario, resetStore } = useProductionStore();
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();
  const completion = useStepCompletion();

  const hasData = productionEvents.length > 0;
  const activeStep = getActiveStep(pathname);

  if (dismissed) return null;

  // State 1: No demo data — show load button
  if (!hasData) {
    return (
      <div
        className="border-b px-6 py-3 flex items-center justify-between"
        style={{
          backgroundColor: "rgba(249, 115, 22, 0.04)",
          borderColor: "rgba(249, 115, 22, 0.15)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-md flex items-center justify-center bg-figma-orange">
            <Play className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium">Golden Thread Demo</p>
            <p className="text-xs text-muted-foreground">
              Load 3 days of realistic field data across 3 WBS codes to explore the full workflow.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-figma-orange hover:bg-figma-orange-hover text-white"
            onClick={() => seedDemoScenario()}
          >
            <Play className="h-3.5 w-3.5" />
            Load Demo Scenario
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // State 2: Demo data loaded — show workflow stepper
  return (
    <div
      className="border-b px-6 py-2.5 flex items-center justify-between"
      style={{
        backgroundColor: "rgba(249, 115, 22, 0.04)",
        borderColor: "rgba(249, 115, 22, 0.15)",
      }}
    >
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Workflow
        </span>

        <div className="flex items-center gap-1">
          {workflowSteps.map((step, i) => {
            const Icon = step.icon;
            const isActive = activeStep === step.key;
            const isComplete = completion[step.key];

            return (
              <div key={step.key} className="flex items-center">
                {i > 0 && (
                  <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground/30" />
                )}
                <Link
                  href={step.href}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    isActive
                      ? "bg-white shadow-sm border text-figma-orange"
                      : "hover:bg-white/60"
                  )}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  {step.label}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Current step instruction */}
        {activeStep && (
          <p className="text-xs text-muted-foreground ml-2 border-l pl-3">
            {workflowSteps.find((s) => s.key === activeStep)?.instruction}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
            >
              Reset Demo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will erase all production events, overrides, and estimating
                records. You&apos;ll need to reload the demo scenario to start
                again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => {
                  resetStore();
                  setDismissed(false);
                }}
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
