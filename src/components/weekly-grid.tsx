"use client";

import React, { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Plus,
  Save,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClaimingSubGrid } from "@/components/claiming-sub-grid";
import { AddCodesModal } from "@/components/add-codes-modal";
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

/* ---------- Date helpers ---------- */

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit" });
}

function formatDateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatWeekRange(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
  return `${fmt(monday)} - ${fmt(friday)}`;
}

/* ---------- Types ---------- */

interface DayCellDraft {
  hours: string;
  units: string;
}

type WeekDraft = Record<string, Record<string, DayCellDraft>>;
// WeekDraft[wbs_code][dateKey] = { hours, units }

// Equipment drafts keyed by wbs_code -> dateKey -> hours string
type EquipDraft = Record<string, Record<string, string>>;

interface CommittedCell {
  hours: number;
  units: number;
  equipHours: number;
}

/* ---------- Component ---------- */

export function WeeklyGrid() {
  const {
    assemblies,
    provisionalCodes,
    claimingSchemas,
    productionEvents,
    kioskEntries,
    addProductionEvent,
    drawdownInventory,
  } = useProductionStore();

  const [mondayDate, setMondayDate] = useState(() => getMonday(new Date()));
  const [drafts, setDrafts] = useState<WeekDraft>({});
  const [equipDrafts, setEquipDrafts] = useState<EquipDraft>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [noteRows, setNoteRows] = useState<Set<string>>(new Set());
  const [claimingDrafts, setClaimingDrafts] = useState<Record<string, ClaimingProgress[]>>({});
  const [showAddCodes, setShowAddCodes] = useState(false);
  const [saved, setSaved] = useState(false);

  const weekDays = useMemo(() => getWeekDays(mondayDate), [mondayDate]);
  const dateKeys = useMemo(() => weekDays.map(formatDateKey), [weekDays]);

  const provisionalAssemblies = useMemo(
    () =>
      provisionalCodes
        .map((code) => assemblies.find((a) => a.wbs_code === code))
        .filter(Boolean),
    [provisionalCodes, assemblies]
  );

  /* ---------- Committed data from store ---------- */

  const committedData = useMemo(() => {
    const map: Record<string, Record<string, CommittedCell>> = {};
    for (const evt of productionEvents) {
      if (!dateKeys.includes(evt.date)) continue;
      if (!map[evt.wbs_code]) map[evt.wbs_code] = {};
      const existing = map[evt.wbs_code][evt.date] ?? { hours: 0, units: 0, equipHours: 0 };
      existing.hours += evt.actual_hours;
      existing.units += evt.actual_qty;
      existing.equipHours += evt.equipment_hours;
      map[evt.wbs_code][evt.date] = existing;
    }
    return map;
  }, [productionEvents, dateKeys]);

  const getCommitted = useCallback(
    (wbs: string, dateKey: string): CommittedCell =>
      committedData[wbs]?.[dateKey] ?? { hours: 0, units: 0, equipHours: 0 },
    [committedData]
  );

  /* ---------- Week navigation ---------- */

  const shiftWeek = (direction: -1 | 1) => {
    if (hasData) {
      const confirmed = window.confirm(
        "You have unsaved changes for this week. Navigating away will discard them. Continue?"
      );
      if (!confirmed) return;
    }
    const next = new Date(mondayDate);
    next.setDate(next.getDate() + direction * 7);
    setMondayDate(next);
    setDrafts({});
    setEquipDrafts({});
    setNotesDraft({});
    setNoteRows(new Set());
    setSaved(false);
  };

  /* ---------- Draft accessors ---------- */

  const getCell = useCallback(
    (wbs: string, dateKey: string): DayCellDraft =>
      drafts[wbs]?.[dateKey] ?? { hours: "", units: "" },
    [drafts]
  );

  const setCell = useCallback(
    (wbs: string, dateKey: string, field: "hours" | "units", value: string) => {
      setDrafts((prev) => ({
        ...prev,
        [wbs]: {
          ...(prev[wbs] ?? {}),
          [dateKey]: {
            ...(prev[wbs]?.[dateKey] ?? { hours: "", units: "" }),
            [field]: value,
          },
        },
      }));
      setSaved(false);
    },
    []
  );

  const getEquipCell = useCallback(
    (wbs: string, dateKey: string): string =>
      equipDrafts[wbs]?.[dateKey] ?? "",
    [equipDrafts]
  );

  const setEquipCell = useCallback(
    (wbs: string, dateKey: string, value: string) => {
      setEquipDrafts((prev) => ({
        ...prev,
        [wbs]: {
          ...(prev[wbs] ?? {}),
          [dateKey]: value,
        },
      }));
      setSaved(false);
    },
    []
  );

  const toggleExpand = (code: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleNote = (code: string) => {
    setNoteRows((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  /* ---------- Row totals (committed + draft) ---------- */

  const getRowTotals = useCallback(
    (wbs: string) => {
      let totalHours = 0;
      let totalUnits = 0;
      for (const dk of dateKeys) {
        const committed = getCommitted(wbs, dk);
        const cell = getCell(wbs, dk);
        totalHours += committed.hours + (parseFloat(cell.hours) || 0);
        totalUnits += committed.units + (parseFloat(cell.units) || 0);
      }
      return { totalHours, totalUnits };
    },
    [dateKeys, getCell, getCommitted]
  );

  /* ---------- Save ---------- */

  const handleSave = () => {
    let entryCount = 0;
    for (const assembly of provisionalAssemblies) {
      if (!assembly) continue;
      const note = notesDraft[assembly.wbs_code] ?? "";
      for (const dk of dateKeys) {
        const cell = getCell(assembly.wbs_code, dk);
        const hours = parseFloat(cell.hours) || 0;
        const units = parseFloat(cell.units) || 0;
        const equipHours = parseFloat(getEquipCell(assembly.wbs_code, dk)) || 0;
        if (hours === 0 && units === 0 && equipHours === 0) continue;

        entryCount++;
        const event = {
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          wbs_code: assembly.wbs_code,
          date: dk,
          actual_hours: hours,
          actual_qty: units,
          equipment_hours: equipHours,
          description: note,
          claiming_progress: claimingDrafts[assembly.wbs_code] ?? [],
          source: "manual" as const,
        };
        addProductionEvent(event);

        // Material drawdown
        if (units > 0) {
          const drawdown = calcMaterialDrawdown(assembly, units);
          if (drawdown.length > 0) {
            drawdownInventory(drawdown);
          }
        }
      }
    }
    setDrafts({});
    setEquipDrafts({});
    setNotesDraft({});
    setNoteRows(new Set());
    setClaimingDrafts({});
    setSaved(true);
    toast.success(`${entryCount} entr${entryCount === 1 ? "y" : "ies"} saved`);
  };

  /* ---------- Derived ---------- */

  const hasData = useMemo(() => {
    for (const wbs of Object.keys(drafts)) {
      for (const dk of Object.keys(drafts[wbs])) {
        const cell = drafts[wbs][dk];
        if ((parseFloat(cell.hours) || 0) > 0 || (parseFloat(cell.units) || 0) > 0) {
          return true;
        }
      }
    }
    for (const wbs of Object.keys(equipDrafts)) {
      for (const dk of Object.keys(equipDrafts[wbs])) {
        if ((parseFloat(equipDrafts[wbs][dk]) || 0) > 0) return true;
      }
    }
    return false;
  }, [drafts, equipDrafts]);

  // Footer: Allocated Hours per day
  const allocatedPerDay = useMemo(() => {
    const totalBudgeted = provisionalAssemblies.reduce(
      (sum, a) => sum + (a?.budgeted_hours ?? 0),
      0
    );
    const daily = totalBudgeted / 5;
    return dateKeys.map(() => daily);
  }, [provisionalAssemblies, dateKeys]);

  // Footer: Total from Timecards per day
  const timecardPerDay = useMemo(() => {
    return dateKeys.map((dk) => {
      return kioskEntries
        .filter((e) => e.date === dk && e.total_hours > 0)
        .reduce((sum, e) => sum + e.total_hours, 0);
    });
  }, [kioskEntries, dateKeys]);

  // Footer: Committed hours per day (sum across all codes)
  const committedPerDay = useMemo(() => {
    return dateKeys.map((dk) => {
      let total = 0;
      for (const wbs of provisionalCodes) {
        total += (committedData[wbs]?.[dk]?.hours ?? 0);
      }
      return total;
    });
  }, [dateKeys, provisionalCodes, committedData]);

  // Does this week have any committed events?
  const weekHasCommitted = useMemo(
    () => committedPerDay.some((v) => v > 0),
    [committedPerDay]
  );

  return (
    <div className="space-y-3">
      {/* Week header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-white text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {formatWeekRange(mondayDate)}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekHasCommitted && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Save className="h-3 w-3" />
              Has logged data
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowAddCodes(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Line
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSave}
            disabled={!hasData || saved}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="w-[200px] text-xs sticky left-0 bg-muted/20 z-10">
                Code
              </TableHead>
              {weekDays.map((day, i) => (
                <TableHead
                  key={dateKeys[i]}
                  className="text-center text-xs min-w-[140px]"
                  colSpan={2}
                >
                  {formatDateShort(day)}
                </TableHead>
              ))}
              <TableHead className="text-center text-xs min-w-[140px] bg-muted/10" colSpan={2}>
                Total
              </TableHead>
              <TableHead className="text-center text-xs w-[60px]">
                PF
              </TableHead>
              <TableHead className="text-center text-xs w-[40px]" />
            </TableRow>
            <TableRow className="bg-muted/10">
              <TableHead className="sticky left-0 bg-muted/10 z-10" />
              {weekDays.map((_, i) => (
                <React.Fragment key={dateKeys[i]}>
                  <TableHead className="text-center text-[10px] text-muted-foreground w-[70px]">
                    Hours
                  </TableHead>
                  <TableHead className="text-center text-[10px] text-muted-foreground w-[70px]">
                    Units
                  </TableHead>
                </React.Fragment>
              ))}
              <TableHead className="text-center text-[10px] text-muted-foreground bg-muted/5 w-[70px]">
                Hours
              </TableHead>
              <TableHead className="text-center text-[10px] text-muted-foreground bg-muted/5 w-[70px]">
                Units
              </TableHead>
              <TableHead />
              <TableHead />
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
              const isNoteOpen = noteRows.has(assembly.wbs_code);
              const rowTotals = getRowTotals(assembly.wbs_code);
              const rowNote = notesDraft[assembly.wbs_code] ?? "";

              // Existing note from latest committed event for this code
              const existingNotes = productionEvents
                .filter((e) => e.wbs_code === assembly.wbs_code && e.description)
                .map((e) => e.description)
                .filter(Boolean);
              const latestNote = existingNotes[existingNotes.length - 1] ?? "";

              // PF from all existing events
              const agg = aggregateEvents(productionEvents, assembly.wbs_code);
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

              // Check if any committed data exists for this row
              const rowHasCommitted = dateKeys.some(
                (dk) => (committedData[assembly.wbs_code]?.[dk]?.hours ?? 0) > 0 ||
                         (committedData[assembly.wbs_code]?.[dk]?.units ?? 0) > 0
              );

              // Only expand if there's a claiming schema
              const canExpand = hasSchema;

              return (
                <TableRow key={assembly.wbs_code} className="group">
                  <TableCell colSpan={15} className="p-0">
                    <div>
                      {/* Main data row */}
                      <div className="flex items-center">
                        {/* Code description - sticky */}
                        <div
                          className="w-[200px] shrink-0 px-3 py-2 flex items-center gap-2 sticky left-0 bg-white z-10 border-r"
                        >
                          {canExpand && (
                            <button
                              onClick={() => toggleExpand(assembly.wbs_code)}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRightIcon className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate leading-tight">
                              {assembly.description}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {assembly.wbs_code}
                            </p>
                          </div>
                        </div>

                        {/* Day cells */}
                        {dateKeys.map((dk) => {
                          const cell = getCell(assembly.wbs_code, dk);
                          const committed = getCommitted(assembly.wbs_code, dk);
                          const hasCommittedHours = committed.hours > 0;
                          const hasCommittedUnits = committed.units > 0;

                          return (
                            <div key={dk} className="flex shrink-0">
                              {/* Hours cell */}
                              <div className={cn(
                                "w-[70px] px-1 py-1",
                                hasCommittedHours && "bg-blue-50/40"
                              )}>
                                {hasCommittedHours && (
                                  <div className="text-[9px] font-mono text-blue-600/70 text-center leading-tight mb-0.5">
                                    {committed.hours.toFixed(1)}
                                  </div>
                                )}
                                <Input
                                  type="number"
                                  placeholder={hasCommittedHours ? "+" : ""}
                                  value={cell.hours}
                                  onChange={(e) =>
                                    setCell(assembly.wbs_code, dk, "hours", e.target.value)
                                  }
                                  className={cn(
                                    "h-6 text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    hasCommittedHours && "bg-white/80"
                                  )}
                                />
                              </div>
                              {/* Units cell */}
                              <div className={cn(
                                "w-[70px] px-1 py-1",
                                hasCommittedUnits && "bg-blue-50/40"
                              )}>
                                {hasCommittedUnits && (
                                  <div className="text-[9px] font-mono text-blue-600/70 text-center leading-tight mb-0.5">
                                    {committed.units.toFixed(1)}
                                  </div>
                                )}
                                <Input
                                  type="number"
                                  placeholder={hasCommittedUnits ? "+" : ""}
                                  value={cell.units}
                                  onChange={(e) =>
                                    setCell(assembly.wbs_code, dk, "units", e.target.value)
                                  }
                                  className={cn(
                                    "h-6 text-center text-xs font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    hasCommittedUnits && "bg-white/80"
                                  )}
                                />
                              </div>
                            </div>
                          );
                        })}

                        {/* Total (committed + draft) */}
                        <div className="flex shrink-0 bg-muted/5">
                          <div className="w-[70px] px-2 py-2 text-center">
                            <span className="text-xs font-mono font-semibold">
                              {rowTotals.totalHours > 0 ? rowTotals.totalHours.toFixed(1) : ""}
                            </span>
                          </div>
                          <div className="w-[70px] px-2 py-2 text-center">
                            <span className="text-xs font-mono font-semibold">
                              {rowTotals.totalUnits > 0 ? rowTotals.totalUnits.toFixed(1) : ""}
                            </span>
                          </div>
                        </div>

                        {/* PF */}
                        <div className="w-[60px] shrink-0 flex items-center justify-center px-2">
                          <PFBadge pf={pf} hasData={agg.totalHours > 0} />
                        </div>

                        {/* Notes toggle */}
                        <div className="w-[40px] shrink-0 flex items-center justify-center">
                          <button
                            onClick={() => toggleNote(assembly.wbs_code)}
                            className={cn(
                              "p-1 rounded transition-colors",
                              isNoteOpen || rowNote || latestNote
                                ? "text-blue-600 hover:bg-blue-50"
                                : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
                            )}
                            title="Toggle notes"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Notes row (inline) */}
                      {isNoteOpen && (
                        <div className="px-4 py-2 border-t bg-blue-50/20 flex items-start gap-3">
                          <MessageSquare className="h-3.5 w-3.5 text-blue-500 mt-1.5 shrink-0" />
                          <div className="flex-1 space-y-1">
                            {latestNote && !rowNote && (
                              <p className="text-[10px] text-muted-foreground italic">
                                Previous: {latestNote}
                              </p>
                            )}
                            <Textarea
                              placeholder="Variance notes, constraints, field conditions..."
                              maxLength={255}
                              value={rowNote}
                              onChange={(e) => {
                                setNotesDraft((prev) => ({
                                  ...prev,
                                  [assembly.wbs_code]: e.target.value,
                                }));
                                setSaved(false);
                              }}
                              className="text-xs resize-none min-h-[48px] bg-white"
                              rows={2}
                            />
                            <p className="text-[10px] text-muted-foreground text-right">
                              {(rowNote || "").length}/255
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Inline equipment hours sub-row */}
                      <div className="flex items-center border-t border-dashed border-muted/60">
                        <div className="w-[200px] shrink-0 px-3 py-0.5 sticky left-0 bg-white z-10 border-r">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Wrench className="h-3 w-3" /> Equip
                          </span>
                        </div>
                        {dateKeys.map((dk) => {
                          const committedEquip = getCommitted(assembly.wbs_code, dk).equipHours;
                          return (
                            <div key={`eq-${dk}`} className="flex shrink-0">
                              <div className={cn("w-[70px] px-1 py-0.5", committedEquip > 0 && "bg-blue-50/40")}>
                                {committedEquip > 0 && (
                                  <div className="text-[9px] font-mono text-blue-600/70 text-center leading-tight">
                                    {committedEquip.toFixed(1)}
                                  </div>
                                )}
                                <Input
                                  type="number"
                                  placeholder={committedEquip > 0 ? "+" : ""}
                                  value={getEquipCell(assembly.wbs_code, dk)}
                                  onChange={(e) => setEquipCell(assembly.wbs_code, dk, e.target.value)}
                                  className="h-5 text-center text-[10px] font-mono px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                              <div className="w-[70px]" />
                            </div>
                          );
                        })}
                        <div className="flex shrink-0 bg-muted/5">
                          <div className="w-[70px]" />
                          <div className="w-[70px]" />
                        </div>
                        <div className="w-[60px]" />
                        <div className="w-[40px]" />
                      </div>

                      {/* Expanded detail (claiming sub-grid only) */}
                      {isExpanded && hasSchema && schema && (
                        <div className="px-6 pb-3 border-t bg-muted/5">
                          <div className="max-w-md pt-3">
                            <ClaimingSubGrid
                              schema={schema}
                              progress={claimingDrafts[assembly.wbs_code] ?? []}
                              onProgressChange={(progress) =>
                                setClaimingDrafts((prev) => ({
                                  ...prev,
                                  [assembly.wbs_code]: progress,
                                }))
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {provisionalAssemblies.length === 0 && (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground py-12">
                  <p className="text-sm">No production quantity codes added.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={() => setShowAddCodes(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Line
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {/* Footer: Committed this week */}
            {provisionalAssemblies.length > 0 && weekHasCommitted && (
              <TableRow className="border-t bg-blue-50/30">
                <TableCell colSpan={15} className="p-0">
                  <div className="flex items-center">
                    <div className="w-[200px] shrink-0 px-3 py-2 sticky left-0 bg-blue-50/30 z-10 border-r">
                      <span className="text-xs font-semibold text-blue-700/70">
                        Logged This Week
                      </span>
                    </div>
                    {committedPerDay.map((hrs, i) => (
                      <div key={`comm-${dateKeys[i]}`} className="flex shrink-0">
                        <div className="w-[70px] px-2 py-2 text-center">
                          <span className="text-xs font-mono text-blue-600/70">
                            {hrs > 0 ? hrs.toFixed(1) : ""}
                          </span>
                        </div>
                        <div className="w-[70px]" />
                      </div>
                    ))}
                    <div className="flex shrink-0 bg-muted/5">
                      <div className="w-[70px] px-2 py-2 text-center">
                        <span className="text-xs font-mono font-semibold text-blue-600/70">
                          {committedPerDay.reduce((a, b) => a + b, 0) > 0
                            ? committedPerDay.reduce((a, b) => a + b, 0).toFixed(1)
                            : ""}
                        </span>
                      </div>
                      <div className="w-[70px]" />
                    </div>
                    <div className="w-[60px]" />
                    <div className="w-[40px]" />
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Footer: Allocated Hours */}
            {provisionalAssemblies.length > 0 && (
              <>
                <TableRow className={cn("border-t-2 bg-muted/10", !weekHasCommitted && "border-t")}>
                  <TableCell colSpan={15} className="p-0">
                    <div className="flex items-center">
                      <div className="w-[200px] shrink-0 px-3 py-2 sticky left-0 bg-muted/10 z-10 border-r">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Avg Daily Budget
                        </span>
                      </div>
                      {allocatedPerDay.map((allocated, i) => (
                        <div key={`alloc-${dateKeys[i]}`} className="flex shrink-0">
                          <div className="w-[70px] px-2 py-2 text-center">
                            <span className="text-xs font-mono text-muted-foreground">
                              {allocated > 0 ? allocated.toFixed(0) : ""}
                            </span>
                          </div>
                          <div className="w-[70px]" />
                        </div>
                      ))}
                      <div className="flex shrink-0 bg-muted/5">
                        <div className="w-[70px] px-2 py-2 text-center">
                          <span className="text-xs font-mono font-semibold text-muted-foreground">
                            {allocatedPerDay.reduce((a, b) => a + b, 0).toFixed(0)}
                          </span>
                        </div>
                        <div className="w-[70px]" />
                      </div>
                      <div className="w-[60px]" />
                      <div className="w-[40px]" />
                    </div>
                  </TableCell>
                </TableRow>

                {/* Footer: Total from Timecards */}
                <TableRow className="bg-muted/5">
                  <TableCell colSpan={15} className="p-0">
                    <div className="flex items-center">
                      <div className="w-[200px] shrink-0 px-3 py-2 sticky left-0 bg-muted/5 z-10 border-r">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Total from Timecards
                        </span>
                      </div>
                      {timecardPerDay.map((tc, i) => (
                        <div key={`tc-${dateKeys[i]}`} className="flex shrink-0">
                          <div className="w-[70px] px-2 py-2 text-center">
                            <span
                              className={cn(
                                "text-xs font-mono",
                                tc > 0
                                  ? tc >= allocatedPerDay[i]
                                    ? "text-green-600 font-semibold"
                                    : "text-amber-600"
                                  : "text-muted-foreground"
                              )}
                            >
                              {tc > 0 ? tc.toFixed(0) : ""}
                            </span>
                          </div>
                          <div className="w-[70px]" />
                        </div>
                      ))}
                      <div className="flex shrink-0 bg-muted/5">
                        <div className="w-[70px] px-2 py-2 text-center">
                          <span className={cn(
                            "text-xs font-mono font-semibold",
                            timecardPerDay.some((t) => t > 0) ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {timecardPerDay.reduce((a, b) => a + b, 0) > 0
                              ? timecardPerDay.reduce((a, b) => a + b, 0).toFixed(0)
                              : ""}
                          </span>
                        </div>
                        <div className="w-[70px]" />
                      </div>
                      <div className="w-[60px]" />
                      <div className="w-[40px]" />
                    </div>
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Line button at bottom, Procore-style */}
      {provisionalAssemblies.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowAddCodes(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Line
        </Button>
      )}

      {/* Add Codes Modal */}
      <AddCodesModal open={showAddCodes} onOpenChange={setShowAddCodes} />
    </div>
  );
}
