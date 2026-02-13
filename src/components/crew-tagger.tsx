"use client";

import { AlertTriangle, Check, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Worker } from "@/store/use-production-store";

interface CrewTaggerProps {
  /** Workers who clocked in on this date with their kiosk hours */
  availableWorkers: (Worker & { kiosk_hours: number })[];
  /** Currently assigned worker IDs */
  assignedWorkerIds: string[];
  /** Per-worker allocated hours for this code */
  workerHours: Record<string, number>;
  /** Per-worker remaining available hours (after other code allocations) */
  workerRemainingHours: Record<string, number>;
  /** Called when a worker is toggled in/out of the crew */
  onToggleWorker: (workerId: string) => void;
  /** Called when a worker's allocated hours change */
  onWorkerHoursChange: (workerId: string, hours: number) => void;
  /** Total auto-aggregated hours for assigned workers */
  totalCrewHours: number;
}

export function CrewTagger({
  availableWorkers,
  assignedWorkerIds,
  workerHours,
  workerRemainingHours,
  onToggleWorker,
  onWorkerHoursChange,
  totalCrewHours,
}: CrewTaggerProps) {
  const assigned = availableWorkers.filter((w) => assignedWorkerIds.includes(w.id));
  const unassigned = availableWorkers.filter((w) => !assignedWorkerIds.includes(w.id));

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Crew Assignment
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <User className="h-3 w-3" />
            {assignedWorkerIds.length} workers
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 font-mono">
            <Clock className="h-3 w-3" />
            {totalCrewHours.toFixed(1)} hrs
          </Badge>
        </div>
      </div>

      {/* Assigned workers */}
      {assigned.length > 0 && (
        <div className="space-y-1">
          {assigned.map((worker) => (
            <WorkerRow
              key={worker.id}
              worker={worker}
              isAssigned
              allocatedHours={workerHours[worker.id] ?? 0}
              remainingHours={workerRemainingHours[worker.id] ?? worker.kiosk_hours}
              onToggle={() => onToggleWorker(worker.id)}
              onHoursChange={(hrs) => onWorkerHoursChange(worker.id, hrs)}
            />
          ))}
        </div>
      )}

      {/* Unassigned workers */}
      {unassigned.length > 0 && (
        <div className="space-y-1">
          {assigned.length > 0 && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2 mb-1">
              Available
            </p>
          )}
          {unassigned.map((worker) => {
            const remaining = workerRemainingHours[worker.id] ?? worker.kiosk_hours;
            return (
              <WorkerRow
                key={worker.id}
                worker={worker}
                isAssigned={false}
                allocatedHours={0}
                remainingHours={remaining}
                onToggle={() => onToggleWorker(worker.id)}
                onHoursChange={() => {}}
              />
            );
          })}
        </div>
      )}

      {availableWorkers.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">
          No workers clocked in for this date.
        </p>
      )}
    </div>
  );
}

function WorkerRow({
  worker,
  isAssigned,
  allocatedHours,
  remainingHours,
  onToggle,
  onHoursChange,
}: {
  worker: Worker & { kiosk_hours: number };
  isAssigned: boolean;
  allocatedHours: number;
  remainingHours: number;
  onToggle: () => void;
  onHoursChange: (hours: number) => void;
}) {
  const noHoursLeft = remainingHours <= 0 && !isAssigned;

  return (
    <div
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md border text-left text-sm transition-colors",
        isAssigned
          ? "border-primary/30 bg-primary/5"
          : noHoursLeft
          ? "border-transparent bg-muted/30 opacity-60"
          : "border-transparent hover:bg-muted"
      )}
    >
      <button
        onClick={onToggle}
        className="shrink-0"
        title={noHoursLeft ? "No remaining hours available" : undefined}
      >
        <div
          className={cn(
            "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
            isAssigned ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {isAssigned ? (
            <Check className="h-3 w-3" />
          ) : noHoursLeft ? (
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          ) : (
            <User className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{worker.name}</p>
        <p className="text-xs text-muted-foreground">
          {worker.role}
          {noHoursLeft && (
            <span className="text-amber-600 ml-1">(fully allocated)</span>
          )}
        </p>
      </div>
      {isAssigned ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Input
            type="number"
            step="0.5"
            min={0}
            max={worker.kiosk_hours}
            value={allocatedHours || ""}
            placeholder={remainingHours.toFixed(1)}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              onHoursChange(Math.min(val, remainingHours + allocatedHours));
            }}
            className="h-6 w-16 text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[10px] text-muted-foreground">
            / {worker.kiosk_hours.toFixed(1)}h
          </span>
        </div>
      ) : (
        <span className="text-xs font-mono text-muted-foreground shrink-0">
          {remainingHours.toFixed(1)}h avail
        </span>
      )}
    </div>
  );
}
