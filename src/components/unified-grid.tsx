"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calendar, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClaimingSubGrid } from "@/components/claiming-sub-grid";
import { RecentEntries } from "@/components/recent-entries";
import { PFBadge } from "@/components/pf-badge";
import {
  useProductionStore,
  type ClaimingProgress,
} from "@/store/use-production-store";
import {
  aggregateEvents,
  calcEarnedHours,
  calcSimplePercentComplete,
  calcClaimingPercentComplete,
  calcPerformanceFactor,
  calcMaterialDrawdown,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface RowDraft {
  actual_hours: string;
  equipment_hours: string;
  actual_qty: string;
  description: string;
  claiming_progress: ClaimingProgress[];
}

export function UnifiedGrid() {
  const {
    assemblies,
    provisionalCodes,
    claimingSchemas,
    productionEvents,
    addProductionEvent,
    drawdownInventory,
  } = useProductionStore();

  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

  const provisionalAssemblies = provisionalCodes
    .map((code) => assemblies.find((a) => a.wbs_code === code))
    .filter(Boolean);

  const toggleExpand = (code: string) => {
    const next = new Set(expandedRows);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setExpandedRows(next);
  };

  const getDraft = (code: string): RowDraft =>
    drafts[code] ?? {
      actual_hours: "",
      equipment_hours: "",
      actual_qty: "",
      description: "",
      claiming_progress: [],
    };

  const updateDraft = (code: string, updates: Partial<RowDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [code]: { ...getDraft(code), ...updates },
    }));
  };

  const submitRow = (wbsCode: string) => {
    const draft = getDraft(wbsCode);
    const actualHours = parseFloat(draft.actual_hours) || 0;
    const equipHours = parseFloat(draft.equipment_hours) || 0;
    const actualQty = parseFloat(draft.actual_qty) || 0;
    const assembly = assemblies.find((a) => a.wbs_code === wbsCode);

    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      wbs_code: wbsCode,
      date: selectedDate,
      actual_hours: actualHours,
      actual_qty: actualQty,
      equipment_hours: equipHours,
      description: draft.description,
      claiming_progress: draft.claiming_progress,
      source: "manual" as const,
    };

    addProductionEvent(event);

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

    const desc = assembly?.description ?? wbsCode;
    toast.success(`${desc} logged`);
  };

  return (
    <div className="space-y-3">
      {/* Date picker */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-44 h-9"
        />
        {selectedDate !== today && (
          <Badge variant="secondary" className="text-xs">
            Backfilling
          </Badge>
        )}
      </div>

      <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Description</TableHead>
            <TableHead className="text-right w-24">Labor Hrs</TableHead>
            <TableHead className="text-right w-24">Equip Hrs</TableHead>
            <TableHead className="text-right w-24">Units</TableHead>
            <TableHead className="w-16 text-center">UOM</TableHead>
            <TableHead className="w-52">Notes</TableHead>
            <TableHead className="w-28 text-center">Status</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
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

            // Aggregate existing events
            const agg = aggregateEvents(
              productionEvents,
              assembly.wbs_code
            );

            // Calculate PF
            let pctComplete: number;
            if (schema) {
              const latestEvent = productionEvents
                .filter((e) => e.wbs_code === assembly.wbs_code)
                .at(-1);
              pctComplete = latestEvent
                ? calcClaimingPercentComplete(
                    schema,
                    latestEvent.claiming_progress
                  )
                : 0;
            } else {
              pctComplete = calcSimplePercentComplete(
                agg.totalQty,
                assembly.budgeted_qty
              );
            }
            const earnedHrs = calcEarnedHours(
              assembly.budgeted_hours,
              pctComplete
            );
            const pf = calcPerformanceFactor(earnedHrs, agg.totalHours);
            const hasHoursNoQty = agg.totalHours > 0 && agg.totalQty === 0;

            return (
              <TableRow
                key={assembly.wbs_code}
                className="group"
              >
                <TableCell colSpan={9} className="p-0">
                  <div>
                    {/* Main row */}
                    <div className="flex items-center px-4 py-3 gap-0">
                      {/* Expand button */}
                      <div className="w-8 flex-shrink-0">
                        {hasSchema && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleExpand(assembly.wbs_code)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Description */}
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="font-medium text-sm truncate">
                          {assembly.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assembly.wbs_code}
                          {agg.totalQty > 0 && (
                            <span className="ml-2">
                              &middot; {agg.totalQty.toLocaleString()}/
                              {assembly.budgeted_qty.toLocaleString()}{" "}
                              {assembly.uom} logged
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Labor Hours */}
                      <div className="w-24 flex-shrink-0 pr-2">
                        <Input
                          type="number"
                          placeholder="0"
                          value={draft.actual_hours}
                          onChange={(e) =>
                            updateDraft(assembly.wbs_code, {
                              actual_hours: e.target.value,
                            })
                          }
                          className="h-8 text-right text-sm"
                        />
                      </div>

                      {/* Equipment Hours */}
                      <div className="w-24 flex-shrink-0 pr-2">
                        <Input
                          type="number"
                          placeholder="0"
                          value={draft.equipment_hours}
                          onChange={(e) =>
                            updateDraft(assembly.wbs_code, {
                              equipment_hours: e.target.value,
                            })
                          }
                          className="h-8 text-right text-sm"
                        />
                      </div>

                      {/* Units */}
                      <div className="w-24 flex-shrink-0 pr-2">
                        <Input
                          type="number"
                          placeholder="0"
                          value={draft.actual_qty}
                          onChange={(e) =>
                            updateDraft(assembly.wbs_code, {
                              actual_qty: e.target.value,
                            })
                          }
                          className="h-8 text-right text-sm"
                        />
                      </div>

                      {/* UOM */}
                      <div className="w-16 flex-shrink-0 text-center">
                        <Badge variant="outline" className="text-xs">
                          {assembly.uom}
                        </Badge>
                      </div>

                      {/* Notes */}
                      <div className="w-52 flex-shrink-0 px-2">
                        <Textarea
                          placeholder="Variance notes..."
                          maxLength={255}
                          value={draft.description}
                          onChange={(e) =>
                            updateDraft(assembly.wbs_code, {
                              description: e.target.value,
                            })
                          }
                          className="h-8 min-h-8 text-xs resize-none py-1.5"
                        />
                      </div>

                      {/* Status */}
                      <div className="w-28 flex-shrink-0 flex items-center justify-center gap-1">
                        {hasHoursNoQty && (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        )}
                        <PFBadge pf={pf} hasData={agg.totalHours > 0} showLabel className="text-xs" />
                      </div>

                      {/* Submit */}
                      <div className="w-20 flex-shrink-0 text-right">
                        <Button
                          size="sm"
                          onClick={() => submitRow(assembly.wbs_code)}
                          disabled={
                            !draft.actual_hours &&
                            !draft.actual_qty &&
                            !draft.equipment_hours
                          }
                        >
                          Log
                        </Button>
                      </div>
                    </div>

                    {/* Claiming Sub-Grid */}
                    {hasSchema && isExpanded && schema && (
                      <div className="px-12 pb-4">
                        <ClaimingSubGrid
                          schema={schema}
                          progress={draft.claiming_progress}
                          onProgressChange={(progress) =>
                            updateDraft(assembly.wbs_code, {
                              claiming_progress: progress,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {provisionalAssemblies.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-center text-muted-foreground py-8"
              >
                No provisional codes selected. Go to Setup to add codes.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>

      {/* Recent entries for selected date */}
      <RecentEntries date={selectedDate} />
    </div>
  );
}
