"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  Save,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { CrewTagger } from "@/components/crew-tagger";
import { useProductionStore } from "@/store/use-production-store";
import {
  aggregateEvents,
  calcEarnedHours,
  calcSimplePercentComplete,
  calcClaimingPercentComplete,
  calcPerformanceFactor,
  calcMaterialDrawdown,
  getAvailableWorkers,
  getRemainingWorkerHours,
  getWorkerAllocatedHours,
  getTotalAllocatedHoursForCode,
} from "@/lib/calculations";
import { ClaimingSubGrid } from "@/components/claiming-sub-grid";
import { RecentEntries } from "@/components/recent-entries";
import { PFBadge } from "@/components/pf-badge";
import type { ClaimingProgress } from "@/store/use-production-store";
import { cn } from "@/lib/utils";

interface CodeDraft {
  worker_ids: string[];
  worker_hours: Record<string, number>;
  manual_hours: string;
  equipment_hours: string;
  actual_qty: string;
  description: string;
  claiming_progress: ClaimingProgress[];
  use_manual_hours: boolean;
}

export function DailyLog() {
  const {
    assemblies,
    provisionalCodes,
    claimingSchemas,
    productionEvents,
    workers,
    kioskEntries,
    workerAllocations,
    addProductionEvent,
    addCrewAssignment,
    drawdownInventory,
    setWorkerAllocation,
    clearWorkerAllocations,
  } = useProductionStore();

  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, CodeDraft>>({});

  // Workers available on selected date (from kiosk)
  const availableWorkers = useMemo(
    () => getAvailableWorkers(workers, kioskEntries, selectedDate),
    [workers, kioskEntries, selectedDate]
  );

  const provisionalAssemblies = provisionalCodes
    .map((code) => assemblies.find((a) => a.wbs_code === code))
    .filter(Boolean);

  const toggleExpand = (code: string) => {
    const next = new Set(expandedRows);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setExpandedRows(next);
  };

  const getDraft = (code: string): CodeDraft =>
    drafts[code] ?? {
      worker_ids: [],
      worker_hours: {},
      manual_hours: "",
      equipment_hours: "",
      actual_qty: "",
      description: "",
      claiming_progress: [],
      use_manual_hours: false,
    };

  const updateDraft = (code: string, updates: Partial<CodeDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [code]: { ...getDraft(code), ...updates },
    }));
  };

  const toggleWorker = (wbsCode: string, workerId: string) => {
    const draft = getDraft(wbsCode);
    const isAssigned = draft.worker_ids.includes(workerId);
    if (isAssigned) {
      // Remove worker and clear allocation
      updateDraft(wbsCode, {
        worker_ids: draft.worker_ids.filter((id) => id !== workerId),
        worker_hours: (() => {
          const h = { ...draft.worker_hours };
          delete h[workerId];
          return h;
        })(),
      });
    } else {
      // Assign worker with remaining available hours
      const remaining = getRemainingWorkerHours(
        workerAllocations,
        kioskEntries,
        workerId,
        selectedDate,
        wbsCode
      );
      updateDraft(wbsCode, {
        worker_ids: [...draft.worker_ids, workerId],
        worker_hours: {
          ...draft.worker_hours,
          [workerId]: remaining,
        },
      });
    }
  };

  const handleWorkerHoursChange = (wbsCode: string, workerId: string, hours: number) => {
    const draft = getDraft(wbsCode);
    updateDraft(wbsCode, {
      worker_hours: { ...draft.worker_hours, [workerId]: hours },
    });
  };

  const getCrewHours = (wbsCode: string): number => {
    const draft = getDraft(wbsCode);
    if (draft.use_manual_hours) {
      return parseFloat(draft.manual_hours) || 0;
    }
    // Sum allocated hours from draft
    return Object.values(draft.worker_hours).reduce((sum, h) => sum + h, 0);
  };

  const submitRow = (wbsCode: string) => {
    const draft = getDraft(wbsCode);
    const totalHours = getCrewHours(wbsCode);
    const equipHours = parseFloat(draft.equipment_hours) || 0;
    const actualQty = parseFloat(draft.actual_qty) || 0;
    const assembly = assemblies.find((a) => a.wbs_code === wbsCode);

    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      wbs_code: wbsCode,
      date: selectedDate,
      actual_hours: totalHours,
      actual_qty: actualQty,
      equipment_hours: equipHours,
      description: draft.description,
      claiming_progress: draft.claiming_progress,
      source: (draft.use_manual_hours ? "manual" : "kiosk") as "kiosk" | "manual",
    };

    addProductionEvent(event);

    // Store crew assignment and persist worker allocations
    if (!draft.use_manual_hours && draft.worker_ids.length > 0) {
      addCrewAssignment({
        id: `ca_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        wbs_code: wbsCode,
        date: selectedDate,
        worker_ids: [...draft.worker_ids],
        auto_hours: totalHours,
        manual_override: null,
      });

      // Persist allocations to store
      for (const workerId of draft.worker_ids) {
        const hrs = draft.worker_hours[workerId] ?? 0;
        if (hrs > 0) {
          setWorkerAllocation(selectedDate, workerId, wbsCode, hrs);
        }
      }
    }

    // Material drawdown
    if (assembly && actualQty > 0) {
      const drawdown = calcMaterialDrawdown(assembly, actualQty);
      if (drawdown.length > 0) {
        drawdownInventory(drawdown);
      }
    }

    // Clear draft
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[wbsCode];
      return next;
    });

    const desc = assemblies.find((a) => a.wbs_code === wbsCode)?.description ?? wbsCode;
    toast.success(`${desc} logged — ${totalHours.toFixed(1)}h, ${actualQty} units`);
  };

  // Day summary stats
  const daySummary = useMemo(() => {
    let totalHours = 0;
    let totalCodes = 0;
    for (const code of provisionalCodes) {
      const draft = drafts[code];
      if (draft) {
        const hours = draft.use_manual_hours
          ? parseFloat(draft.manual_hours) || 0
          : Object.values(draft.worker_hours).reduce((s, h) => s + h, 0);
        if (hours > 0 || draft.worker_ids.length > 0) {
          totalHours += hours;
          totalCodes++;
        }
      }
    }
    return { totalHours, totalCodes };
  }, [provisionalCodes, drafts]);

  return (
    <div className="space-y-4">
      {/* Date + Day Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44 h-9"
            />
          </div>
          <Badge variant="secondary" className="text-xs">
            {availableWorkers.length} workers on-site
          </Badge>
        </div>
        {daySummary.totalHours > 0 && (
          <Card className="px-4 py-2">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Pending Hours</span>
                <p className="font-bold font-mono">{daySummary.totalHours.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Active Codes</span>
                <p className="font-bold font-mono">{daySummary.totalCodes}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Per-code rows */}
      <div className="space-y-3">
        {provisionalAssemblies.map((assembly) => {
          if (!assembly) return null;

          const hasSchema =
            !!assembly.claiming_schema_id &&
            !!claimingSchemas[assembly.claiming_schema_id];
          const schema = hasSchema
            ? claimingSchemas[assembly.claiming_schema_id!]
            : null;
          const isExpanded = expandedRows.has(assembly.wbs_code);
          const draft = getDraft(assembly.wbs_code);
          const crewHours = getCrewHours(assembly.wbs_code);

          // Aggregate existing events
          const agg = aggregateEvents(productionEvents, assembly.wbs_code);

          // Calculate PF
          let pctComplete: number;
          if (schema) {
            const latestEvent = productionEvents
              .filter((e) => e.wbs_code === assembly.wbs_code)
              .at(-1);
            pctComplete = latestEvent
              ? calcClaimingPercentComplete(schema, latestEvent.claiming_progress)
              : 0;
          } else {
            pctComplete = calcSimplePercentComplete(agg.totalQty, assembly.budgeted_qty);
          }
          const earnedHrs = calcEarnedHours(assembly.budgeted_hours, pctComplete);
          const pf = calcPerformanceFactor(earnedHrs, agg.totalHours);
          const hasHoursNoQty = agg.totalHours > 0 && agg.totalQty === 0;

          const canSubmit = crewHours > 0 || parseFloat(draft.actual_qty || "0") > 0;

          // Compute per-worker remaining hours for crew tagger
          const workerRemainingHours: Record<string, number> = {};
          for (const w of availableWorkers) {
            workerRemainingHours[w.id] = getRemainingWorkerHours(
              workerAllocations,
              kioskEntries,
              w.id,
              selectedDate,
              assembly.wbs_code
            );
          }

          return (
            <Card key={assembly.wbs_code} className="overflow-hidden">
              {/* Header row — with inline units input and log button */}
              <div className="flex items-center gap-3 px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => toggleExpand(assembly.wbs_code)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {assembly.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assembly.wbs_code}
                    {agg.totalQty > 0 && (
                      <span className="ml-2">
                        &middot; {agg.totalQty.toLocaleString()}/{assembly.budgeted_qty.toLocaleString()} {assembly.uom}
                      </span>
                    )}
                  </p>
                </div>

                {/* Crew hours indicator */}
                <Badge variant="outline" className="text-xs font-mono gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  {crewHours.toFixed(1)}h
                  {draft.use_manual_hours && <span className="text-muted-foreground">(manual)</span>}
                </Badge>

                {/* Inline units input */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    type="number"
                    placeholder="Units"
                    value={draft.actual_qty}
                    onChange={(e) =>
                      updateDraft(assembly.wbs_code, { actual_qty: e.target.value })
                    }
                    className="h-8 w-20 text-right text-sm font-mono"
                  />
                  <span className="text-[10px] text-muted-foreground">{assembly.uom}</span>
                </div>

                {/* PF Badge */}
                <div className="w-16 flex items-center justify-center gap-1 shrink-0">
                  {hasHoursNoQty && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                  <PFBadge pf={pf} hasData={agg.totalHours > 0} />
                </div>

                <Button
                  size="sm"
                  onClick={() => submitRow(assembly.wbs_code)}
                  disabled={!canSubmit}
                  className="shrink-0 gap-1"
                >
                  <Save className="h-3.5 w-3.5" />
                  Log
                </Button>
              </div>

              {/* Expanded content — crew details, equipment, notes */}
              {isExpanded && (
                <CardContent className="border-t pt-4 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
                    {/* Left: crew tagger + claiming */}
                    <div className="space-y-4">
                      {/* Crew tagger */}
                      <CrewTagger
                        availableWorkers={availableWorkers}
                        assignedWorkerIds={draft.worker_ids}
                        workerHours={draft.worker_hours}
                        workerRemainingHours={workerRemainingHours}
                        onToggleWorker={(id) => toggleWorker(assembly.wbs_code, id)}
                        onWorkerHoursChange={(id, hrs) =>
                          handleWorkerHoursChange(assembly.wbs_code, id, hrs)
                        }
                        totalCrewHours={crewHours}
                      />

                      {/* Manual override toggle */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateDraft(assembly.wbs_code, {
                              use_manual_hours: !draft.use_manual_hours,
                            })
                          }
                          className={cn(
                            "text-xs px-2 py-1 rounded-md border transition-colors",
                            draft.use_manual_hours
                              ? "bg-amber-50 border-amber-300 text-amber-700"
                              : "border-transparent text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {draft.use_manual_hours ? "Using manual hours" : "Switch to manual hours"}
                        </button>
                      </div>

                      {/* Manual hours input (shown when manual mode) */}
                      {draft.use_manual_hours && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground shrink-0">Manual Hours:</label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={draft.manual_hours}
                            onChange={(e) =>
                              updateDraft(assembly.wbs_code, { manual_hours: e.target.value })
                            }
                            className="h-8 w-28 text-right text-sm font-mono"
                          />
                        </div>
                      )}

                      {/* Claiming schema */}
                      {hasSchema && schema && (
                        <ClaimingSubGrid
                          schema={schema}
                          progress={draft.claiming_progress}
                          onProgressChange={(progress) =>
                            updateDraft(assembly.wbs_code, { claiming_progress: progress })
                          }
                        />
                      )}
                    </div>

                    {/* Right: equipment, notes */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Equipment Hours</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={draft.equipment_hours}
                          onChange={(e) =>
                            updateDraft(assembly.wbs_code, { equipment_hours: e.target.value })
                          }
                          className="h-8 text-right text-sm font-mono mt-1"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground">Notes</label>
                        <Textarea
                          placeholder="Variance notes, constraints..."
                          maxLength={255}
                          value={draft.description}
                          onChange={(e) =>
                            updateDraft(assembly.wbs_code, { description: e.target.value })
                          }
                          className="text-xs resize-none mt-1"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {provisionalAssemblies.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm">
              <Settings className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No provisional codes selected.</p>
              <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5">
                <Link href="/setup">
                  <Settings className="h-3.5 w-3.5" />
                  Go to Setup
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent entries for selected date */}
        <RecentEntries date={selectedDate} />
      </div>
    </div>
  );
}
