"use client";

import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { ClaimingSchema, ClaimingProgress } from "@/store/use-production-store";

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

  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Rules of Credit — {schema.name}
        </p>
        <span className="text-sm font-bold">
          {(totalWeightedComplete * 100).toFixed(1)}% Complete
        </span>
      </div>
      <Progress value={totalWeightedComplete * 100} className="h-2" />
      <div className="space-y-2">
        {schema.steps.map((step) => {
          const p = progress.find((pr) => pr.step_name === step.name);
          const pct = p?.percent_complete ?? 0;
          return (
            <div key={step.name} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-14 text-right font-mono">
                {(step.weight * 100).toFixed(0)}%
              </span>
              <span className="text-sm flex-1 min-w-0 truncate">
                {step.name}
              </span>
              <div className="flex items-center gap-2 w-28">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(e) =>
                    handleStepChange(step.name, Number(e.target.value))
                  }
                  className="h-7 text-xs text-right w-16"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
