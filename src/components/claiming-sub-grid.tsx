"use client";

import React from "react";
import { CheckCircle2, Circle, Award } from "lucide-react";
import type {
  ClaimingSchema,
  ClaimingProgress,
} from "@/store/use-production-store";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Shared input styling (matches weekly-grid cells)                   */
/* ------------------------------------------------------------------ */

const stepInputCls =
  "w-16 h-8 text-center text-sm font-mono bg-muted/[0.06] border border-muted/30 outline-none rounded-md transition-all placeholder:text-muted-foreground/40 hover:border-muted-foreground/30 hover:bg-white focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusColor(pct: number): string {
  if (pct >= 100) return "text-green-600";
  if (pct > 0) return "text-primary";
  return "text-muted-foreground/30";
}

function weightedLabel(pct: number): string {
  if (pct >= 100) return "Complete";
  if (pct > 0) return "In Progress";
  return "Not Started";
}

/* ------------------------------------------------------------------ */
/*  Ring progress indicator                                            */
/* ------------------------------------------------------------------ */

function MiniRing({ pct, size = 32 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        className="text-muted/30"
      />
      {/* Fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={cn(
          "transition-all duration-500",
          pct >= 100 ? "text-green-500" : pct > 0 ? "text-primary" : "text-muted/20"
        )}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ClaimingSubGridProps {
  schema: ClaimingSchema;
  progress: ClaimingProgress[];
  onProgressChange: (progress: ClaimingProgress[]) => void;
}

export function ClaimingSubGrid({
  schema,
  progress,
  onProgressChange,
}: ClaimingSubGridProps) {
  const totalWeightedComplete = schema.steps.reduce((sum, step) => {
    const p = progress.find((pr) => pr.step_name === step.name);
    return sum + step.weight * ((p?.percent_complete ?? 0) / 100);
  }, 0);

  const completedSteps = schema.steps.filter((step) => {
    const p = progress.find((pr) => pr.step_name === step.name);
    return (p?.percent_complete ?? 0) >= 100;
  }).length;

  const handleStepChange = (stepName: string, value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    const existing = progress.find((p) => p.step_name === stepName);
    if (existing) {
      onProgressChange(
        progress.map((p) =>
          p.step_name === stepName ? { ...p, percent_complete: clamped } : p
        )
      );
    } else {
      onProgressChange([
        ...progress,
        { step_name: stepName, percent_complete: clamped },
      ]);
    }
  };

  const overallPct = totalWeightedComplete * 100;

  return (
    <div className="flex gap-6 items-start">
      {/* ---- LEFT: Summary hero ---- */}
      <div className="shrink-0 flex flex-col items-center gap-2 pt-1 w-[120px]">
        {/* Large ring */}
        <div className="relative">
          <MiniRing pct={overallPct} size={72} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-base font-bold font-mono">
              {overallPct.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-[11px] font-semibold text-foreground leading-tight">
            Rules of Credit
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            {completedSteps}/{schema.steps.length} steps complete
          </p>
        </div>
      </div>

      {/* ---- RIGHT: Steps table ---- */}
      <div className="flex-1 min-w-0">
        {/* Schema name header */}
        <div className="flex items-center gap-2 mb-3">
          <Award className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold text-foreground">
            {schema.name}
          </p>
        </div>

        {/* Steps */}
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--figma-bg-outline)" }}>
          {schema.steps.map((step, idx) => {
            const p = progress.find((pr) => pr.step_name === step.name);
            const pct = p?.percent_complete ?? 0;
            const isComplete = pct >= 100;
            const isLast = idx === schema.steps.length - 1;

            return (
              <div
                key={step.name}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/5",
                  !isLast && "border-b",
                  isComplete && "bg-green-50/30"
                )}
                style={{ borderColor: "var(--figma-bg-outline)" }}
              >
                {/* Status icon */}
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Circle className={cn("h-4 w-4 shrink-0", statusColor(pct))} />
                )}

                {/* Step name */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm leading-tight truncate",
                    isComplete && "text-muted-foreground line-through"
                  )}>
                    {step.name}
                  </p>
                </div>

                {/* Weight badge */}
                <span className="shrink-0 inline-flex items-center rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                  {(step.weight * 100).toFixed(0)}% wt
                </span>

                {/* Status label */}
                <span className={cn(
                  "shrink-0 w-[72px] text-[10px] font-medium text-right",
                  isComplete ? "text-green-600" : pct > 0 ? "text-primary" : "text-muted-foreground/50"
                )}>
                  {weightedLabel(pct)}
                </span>

                {/* Input */}
                <div className="shrink-0 flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pct}
                    onChange={(e) =>
                      handleStepChange(step.name, Number(e.target.value))
                    }
                    className={stepInputCls}
                  />
                  <span className="text-xs text-muted-foreground font-medium">%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
