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
  Search,
  Filter,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClaimingSubGrid } from "@/components/claiming-sub-grid";
import { AddCodesModal } from "@/components/add-codes-modal";
import { MaterialDrawdown } from "@/components/material-drawdown";
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

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */

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

function fmtDayHeader(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function fmtDateSub(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

function formatDateKey(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatWeekRange(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(monday)} – ${fmt(friday)}`;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DayCellDraft {
  hours: string;
  units: string;
}
type WeekDraft = Record<string, Record<string, DayCellDraft>>;
type EquipDraft = Record<string, Record<string, string>>;
interface CommittedCell {
  hours: number;
  units: number;
  equipHours: number;
}

/* ------------------------------------------------------------------ */
/*  Column widths — single source of truth (px)                        */
/* ------------------------------------------------------------------ */

const W = {
  code: 240,
  cell: 96,
  pf: 64,
  action: 48,
} as const;

/* Colgroup — renders identical <colgroup> for both main table and footer */
function ColDefs() {
  return (
    <colgroup>
      <col style={{ width: W.code }} />
      {/* 5 days × 2 columns = 10 */}
      {Array.from({ length: 5 }).map((_, dayIdx) => (
        <React.Fragment key={dayIdx}>
          <col style={{ width: W.cell }} />
          <col style={{ width: W.cell }} />
        </React.Fragment>
      ))}
      {/* Totals */}
      <col style={{ width: W.cell }} />
      <col style={{ width: W.cell }} />
      {/* PF + action */}
      <col style={{ width: W.pf }} />
      <col style={{ width: W.action }} />
    </colgroup>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared input component (raw <input>, no wrapper overhead)          */
/* ------------------------------------------------------------------ */

const cellInputBase =
  "w-full h-9 text-center text-sm font-mono bg-muted/[0.06] border border-muted/30 outline-none rounded-md transition-all placeholder:text-muted-foreground/40 hover:border-muted-foreground/30 hover:bg-white focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

interface CellInputProps {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  small?: boolean;
}

function CellInput({ value, placeholder, onChange, small }: CellInputProps) {
  return (
    <input
      type="number"
      value={value}
      placeholder={placeholder ?? "–"}
      onChange={(e) => onChange(e.target.value)}
      className={cn(cellInputBase, small && "h-7 text-xs")}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Day-column background for alternation                              */
/* ------------------------------------------------------------------ */

const dayBg = (dayIdx: number) =>
  dayIdx % 2 === 1 ? "bg-muted/[0.04]" : "";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
  const [claimingDrafts, setClaimingDrafts] = useState<
    Record<string, ClaimingProgress[]>
  >({});
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

  /* ---------- Committed data ---------- */

  const committedData = useMemo(() => {
    const map: Record<string, Record<string, CommittedCell>> = {};
    for (const evt of productionEvents) {
      if (!dateKeys.includes(evt.date)) continue;
      if (!map[evt.wbs_code]) map[evt.wbs_code] = {};
      const existing = map[evt.wbs_code][evt.date] ?? {
        hours: 0,
        units: 0,
        equipHours: 0,
      };
      existing.hours += evt.actual_hours;
      existing.units += evt.actual_qty;
      existing.equipHours += evt.equipment_hours;
      map[evt.wbs_code][evt.date] = existing;
    }
    return map;
  }, [productionEvents, dateKeys]);

  const getCommitted = useCallback(
    (wbs: string, dk: string): CommittedCell =>
      committedData[wbs]?.[dk] ?? { hours: 0, units: 0, equipHours: 0 },
    [committedData]
  );

  /* ---------- Week navigation ---------- */

  const shiftWeek = (dir: -1 | 1) => {
    if (
      hasData &&
      !window.confirm(
        "You have unsaved changes. Navigating away will discard them. Continue?"
      )
    )
      return;
    const next = new Date(mondayDate);
    next.setDate(next.getDate() + dir * 7);
    setMondayDate(next);
    setDrafts({});
    setEquipDrafts({});
    setNotesDraft({});
    setNoteRows(new Set());
    setSaved(false);
  };

  /* ---------- Draft accessors ---------- */

  const getCell = useCallback(
    (wbs: string, dk: string): DayCellDraft =>
      drafts[wbs]?.[dk] ?? { hours: "", units: "" },
    [drafts]
  );

  const setCell = useCallback(
    (wbs: string, dk: string, field: "hours" | "units", value: string) => {
      setDrafts((prev) => ({
        ...prev,
        [wbs]: {
          ...(prev[wbs] ?? {}),
          [dk]: {
            ...(prev[wbs]?.[dk] ?? { hours: "", units: "" }),
            [field]: value,
          },
        },
      }));
      setSaved(false);
    },
    []
  );

  const getEquipCell = useCallback(
    (wbs: string, dk: string): string => equipDrafts[wbs]?.[dk] ?? "",
    [equipDrafts]
  );

  const setEquipCell = useCallback(
    (wbs: string, dk: string, value: string) => {
      setEquipDrafts((prev) => ({
        ...prev,
        [wbs]: { ...(prev[wbs] ?? {}), [dk]: value },
      }));
      setSaved(false);
    },
    []
  );

  const toggleExpand = (code: string) =>
    setExpandedRows((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  const toggleNote = (code: string) =>
    setNoteRows((prev) => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });

  /* ---------- Row totals ---------- */

  const getRowTotals = useCallback(
    (wbs: string) => {
      let totalHours = 0,
        totalUnits = 0;
      for (const dk of dateKeys) {
        const c = getCommitted(wbs, dk),
          d = getCell(wbs, dk);
        totalHours += c.hours + (parseFloat(d.hours) || 0);
        totalUnits += c.units + (parseFloat(d.units) || 0);
      }
      return { totalHours, totalUnits };
    },
    [dateKeys, getCell, getCommitted]
  );

  /* ---------- Save ---------- */

  const handleSave = () => {
    let count = 0;
    for (const assembly of provisionalAssemblies) {
      if (!assembly) continue;
      const note = notesDraft[assembly.wbs_code] ?? "";
      for (const dk of dateKeys) {
        const cell = getCell(assembly.wbs_code, dk);
        const h = parseFloat(cell.hours) || 0,
          u = parseFloat(cell.units) || 0;
        const eq = parseFloat(getEquipCell(assembly.wbs_code, dk)) || 0;
        if (h === 0 && u === 0 && eq === 0) continue;
        count++;
        addProductionEvent({
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          wbs_code: assembly.wbs_code,
          date: dk,
          actual_hours: h,
          actual_qty: u,
          equipment_hours: eq,
          description: note,
          claiming_progress: claimingDrafts[assembly.wbs_code] ?? [],
          source: "manual",
        });
        if (u > 0) {
          const d = calcMaterialDrawdown(assembly, u);
          if (d.length > 0) drawdownInventory(d);
        }
      }
    }
    setDrafts({});
    setEquipDrafts({});
    setNotesDraft({});
    setNoteRows(new Set());
    setClaimingDrafts({});
    setSaved(true);
    toast.success(`${count} entr${count === 1 ? "y" : "ies"} saved`);
  };

  /* ---------- Derived ---------- */

  const hasData = useMemo(() => {
    for (const wbs of Object.keys(drafts))
      for (const dk of Object.keys(drafts[wbs])) {
        const c = drafts[wbs][dk];
        if (
          (parseFloat(c.hours) || 0) > 0 ||
          (parseFloat(c.units) || 0) > 0
        )
          return true;
      }
    for (const wbs of Object.keys(equipDrafts))
      for (const dk of Object.keys(equipDrafts[wbs])) {
        if ((parseFloat(equipDrafts[wbs][dk]) || 0) > 0) return true;
      }
    return false;
  }, [drafts, equipDrafts]);

  const allocatedPerDay = useMemo(() => {
    const daily =
      provisionalAssemblies.reduce(
        (s, a) => s + (a?.budgeted_hours ?? 0),
        0
      ) / 5;
    return dateKeys.map(() => daily);
  }, [provisionalAssemblies, dateKeys]);

  const timecardPerDay = useMemo(
    () =>
      dateKeys.map((dk) =>
        kioskEntries
          .filter((e) => e.date === dk && e.total_hours > 0)
          .reduce((s, e) => s + e.total_hours, 0)
      ),
    [kioskEntries, dateKeys]
  );

  const committedPerDay = useMemo(
    () =>
      dateKeys.map((dk) => {
        let t = 0;
        for (const w of provisionalCodes) t += committedData[w]?.[dk]?.hours ?? 0;
        return t;
      }),
    [dateKeys, provisionalCodes, committedData]
  );

  const weekHasCommitted = useMemo(
    () => committedPerDay.some((v) => v > 0),
    [committedPerDay]
  );

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <>
      {/* ============================================================ */}
      {/* CONTENT CONTROLS                                              */}
      {/* ============================================================ */}
      <div
        className="shrink-0 bg-white border-b px-6 py-2 flex items-center justify-between"
        style={{ borderColor: "var(--figma-bg-outline)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md w-40 bg-white"
            style={{ borderColor: "var(--figma-bg-outline)" }}
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Search...</span>
          </div>
          <button
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-md text-muted-foreground hover:bg-muted/30 transition-colors"
            style={{ borderColor: "var(--figma-bg-outline)" }}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
          </button>
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => shiftWeek(-1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md bg-white text-xs font-medium"
              style={{ borderColor: "var(--figma-bg-outline)" }}
            >
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {formatWeekRange(mondayDate)}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => shiftWeek(1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
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
            className="gap-1.5 text-xs h-8"
            onClick={() => setShowAddCodes(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Line
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs h-8"
            style={{
              backgroundColor: "var(--figma-cta-p1-bg)",
              color: "var(--figma-cta-p1-text)",
            }}
            onClick={handleSave}
            disabled={!hasData || saved}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MAIN LAYOUT — table + sidebar                                 */}
      {/* ============================================================ */}
      <div className="flex-1 flex min-h-0">
        {/* Table area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Scrollable table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <ColDefs />

              {/* ===== HEADER ===== */}
              <thead className="sticky top-0 z-10">
                {/* Row 1: Day names + dates */}
                <tr className="bg-muted/10 border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                  <th className="sticky left-0 z-20 bg-muted/10 text-left px-4 py-2.5 text-xs font-semibold text-foreground border-r" style={{ borderColor: "var(--figma-bg-outline)" }}>
                    Code / Description
                  </th>
                  {weekDays.map((day, i) => (
                    <th
                      key={dateKeys[i]}
                      colSpan={2}
                      className={cn(
                        "text-center py-2.5 border-l",
                        dayBg(i)
                      )}
                      style={{ borderColor: "var(--figma-bg-outline)" }}
                    >
                      <div className="text-xs font-semibold leading-snug">
                        {fmtDayHeader(day)}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-normal leading-snug">
                        {fmtDateSub(day)}
                      </div>
                    </th>
                  ))}
                  <th
                    colSpan={2}
                    className="text-center py-2.5 border-l-2 bg-muted/15"
                    style={{ borderColor: "var(--figma-bg-outline)" }}
                  >
                    <div className="text-xs font-semibold">Total</div>
                  </th>
                  <th className="text-center py-2.5 text-xs font-semibold border-l" style={{ borderColor: "var(--figma-bg-outline)" }}>
                    PF
                  </th>
                  <th className="py-2.5" />
                </tr>

                {/* Row 2: Hours / Units sub-headers */}
                <tr className="bg-muted/10 border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                  <th className="sticky left-0 z-20 bg-muted/10 border-r" style={{ borderColor: "var(--figma-bg-outline)" }} />
                  {weekDays.map((_, i) => (
                    <React.Fragment key={`sub-${dateKeys[i]}`}>
                      <th
                        className={cn(
                          "text-center py-1.5 text-[10px] text-muted-foreground font-medium tracking-wider uppercase border-l",
                          dayBg(i)
                        )}
                        style={{ borderColor: "var(--figma-bg-outline)" }}
                      >
                        Hrs
                      </th>
                      <th
                        className={cn(
                          "text-center py-1.5 text-[10px] text-muted-foreground font-medium tracking-wider uppercase",
                          dayBg(i)
                        )}
                      >
                        Qty
                      </th>
                    </React.Fragment>
                  ))}
                  <th className="text-center py-1.5 text-[10px] text-muted-foreground font-medium tracking-wider uppercase border-l-2 bg-muted/15" style={{ borderColor: "var(--figma-bg-outline)" }}>
                    Hrs
                  </th>
                  <th className="text-center py-1.5 text-[10px] text-muted-foreground font-medium tracking-wider uppercase bg-muted/15">
                    Qty
                  </th>
                  <th className="border-l" style={{ borderColor: "var(--figma-bg-outline)" }} />
                  <th />
                </tr>
              </thead>

              {/* ===== BODY ===== */}
              <tbody>
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
                  const existingNotes = productionEvents
                    .filter(
                      (e) =>
                        e.wbs_code === assembly.wbs_code && e.description
                    )
                    .map((e) => e.description)
                    .filter(Boolean);
                  const latestNote =
                    existingNotes[existingNotes.length - 1] ?? "";

                  const agg = aggregateEvents(
                    productionEvents,
                    assembly.wbs_code
                  );
                  let pctComplete: number;
                  if (schema) {
                    const le = productionEvents
                      .filter((e) => e.wbs_code === assembly.wbs_code)
                      .at(-1);
                    pctComplete = le
                      ? calcClaimingPercentComplete(
                          schema,
                          le.claiming_progress
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
                  const canExpand = hasSchema;

                  return (
                    <React.Fragment key={assembly.wbs_code}>
                      {/* ======== MAIN DATA ROW ======== */}
                      <tr className="border-b group hover:bg-sky-50/40 transition-colors" style={{ borderColor: "var(--figma-bg-outline)" }}>
                        {/* Code cell — sticky left */}
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-sky-50/40 transition-colors px-4 py-3 border-r align-top" style={{ borderColor: "var(--figma-bg-outline)" }}>
                          <div className="flex items-start gap-2">
                            {canExpand ? (
                              <button
                                onClick={() =>
                                  toggleExpand(assembly.wbs_code)
                                }
                                className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRightIcon className="h-4 w-4" />
                                )}
                              </button>
                            ) : (
                              <div className="w-4 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate leading-snug">
                                {assembly.description}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono leading-none mt-1">
                                {assembly.wbs_code}
                                {assembly.uom && (
                                  <span className="ml-1.5 text-muted-foreground/60">
                                    · {assembly.uom}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Day cells — Hours + Units per day */}
                        {dateKeys.map((dk, dayIdx) => {
                          const cell = getCell(assembly.wbs_code, dk);
                          const committed = getCommitted(
                            assembly.wbs_code,
                            dk
                          );

                          return (
                            <React.Fragment key={dk}>
                              {/* Hours */}
                              <td
                                className={cn(
                                  "border-l px-1.5 py-2 align-middle",
                                  dayBg(dayIdx)
                                )}
                                style={{ borderColor: "var(--figma-bg-outline)" }}
                              >
                                <CellInput
                                  value={cell.hours}
                                  placeholder={
                                    committed.hours > 0
                                      ? committed.hours.toFixed(1)
                                      : "–"
                                  }
                                  onChange={(v) =>
                                    setCell(
                                      assembly.wbs_code,
                                      dk,
                                      "hours",
                                      v
                                    )
                                  }
                                />
                              </td>
                              {/* Units */}
                              <td
                                className={cn(
                                  "px-1.5 py-2 align-middle",
                                  dayBg(dayIdx)
                                )}
                              >
                                <CellInput
                                  value={cell.units}
                                  placeholder={
                                    committed.units > 0
                                      ? committed.units.toFixed(1)
                                      : "–"
                                  }
                                  onChange={(v) =>
                                    setCell(
                                      assembly.wbs_code,
                                      dk,
                                      "units",
                                      v
                                    )
                                  }
                                />
                              </td>
                            </React.Fragment>
                          );
                        })}

                        {/* Total Hours */}
                        <td className="border-l-2 text-center py-2 bg-muted/10 align-middle" style={{ borderColor: "var(--figma-bg-outline)" }}>
                          <span className="text-sm font-mono font-semibold">
                            {rowTotals.totalHours > 0
                              ? rowTotals.totalHours.toFixed(1)
                              : ""}
                          </span>
                        </td>
                        {/* Total Units */}
                        <td className="text-center py-2 bg-muted/10 align-middle">
                          <span className="text-sm font-mono font-semibold">
                            {rowTotals.totalUnits > 0
                              ? rowTotals.totalUnits.toFixed(1)
                              : ""}
                          </span>
                        </td>

                        {/* PF */}
                        <td className="text-center border-l align-middle" style={{ borderColor: "var(--figma-bg-outline)" }}>
                          <PFBadge pf={pf} hasData={agg.totalHours > 0} />
                        </td>

                        {/* Notes */}
                        <td className="text-center align-middle">
                          <button
                            onClick={() =>
                              toggleNote(assembly.wbs_code)
                            }
                            className={cn(
                              "p-1.5 rounded transition-colors",
                              isNoteOpen || rowNote || latestNote
                                ? "text-primary hover:bg-primary/10"
                                : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/30"
                            )}
                            title="Toggle notes"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>

                      {/* ======== EQUIPMENT SUB-ROW ======== */}
                      <tr
                        className="border-b border-dashed bg-muted/[0.02]"
                        style={{ borderColor: "color-mix(in srgb, var(--figma-bg-outline) 50%, transparent)" }}
                      >
                        <td className="sticky left-0 z-10 bg-white px-4 py-1 border-r" style={{ borderColor: "var(--figma-bg-outline)" }}>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 pl-6">
                            <Wrench className="h-3 w-3" />
                            Equipment Hrs
                          </span>
                        </td>
                        {dateKeys.map((dk, dayIdx) => {
                          const ce = getCommitted(
                            assembly.wbs_code,
                            dk
                          ).equipHours;
                          return (
                            <React.Fragment key={`eq-${dk}`}>
                              <td
                                className={cn(
                                  "border-l px-1.5 py-1 align-middle",
                                  dayBg(dayIdx)
                                )}
                                style={{ borderColor: "var(--figma-bg-outline)" }}
                              >
                                <CellInput
                                  value={getEquipCell(
                                    assembly.wbs_code,
                                    dk
                                  )}
                                  placeholder={
                                    ce > 0 ? ce.toFixed(1) : "–"
                                  }
                                  onChange={(v) =>
                                    setEquipCell(
                                      assembly.wbs_code,
                                      dk,
                                      v
                                    )
                                  }
                                  small
                                />
                              </td>
                              <td className={cn(dayBg(dayIdx))} />
                            </React.Fragment>
                          );
                        })}
                        <td className="border-l-2 bg-muted/10" style={{ borderColor: "var(--figma-bg-outline)" }} />
                        <td className="bg-muted/10" />
                        <td className="border-l" style={{ borderColor: "var(--figma-bg-outline)" }} />
                        <td />
                      </tr>

                      {/* ======== NOTES ROW ======== */}
                      {isNoteOpen && (
                        <tr className="border-b bg-muted/[0.03]" style={{ borderColor: "var(--figma-bg-outline)" }}>
                          <td colSpan={15} className="px-4 py-3">
                            <div className="flex items-start gap-3 max-w-2xl pl-6">
                              <MessageSquare className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                              <div className="flex-1 space-y-1">
                                {latestNote && !rowNote && (
                                  <p className="text-[11px] text-muted-foreground italic">
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
                                  className="text-sm resize-none min-h-[56px] bg-white"
                                  rows={2}
                                />
                                <p className="text-[11px] text-muted-foreground text-right">
                                  {(rowNote || "").length}/255
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ======== CLAIMING SUB-GRID ======== */}
                      {isExpanded && hasSchema && schema && (
                        <tr className="border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                          <td colSpan={15} className="bg-gradient-to-b from-muted/[0.06] to-transparent">
                            <div className="px-6 py-5 max-w-3xl ml-6">
                              <ClaimingSubGrid
                                schema={schema}
                                progress={
                                  claimingDrafts[assembly.wbs_code] ?? []
                                }
                                onProgressChange={(progress) =>
                                  setClaimingDrafts((prev) => ({
                                    ...prev,
                                    [assembly.wbs_code]: progress,
                                  }))
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Empty state */}
                {provisionalAssemblies.length === 0 && (
                  <tr>
                    <td
                      colSpan={15}
                      className="text-center text-muted-foreground py-20"
                    >
                      <div className="space-y-3">
                        <p className="text-sm">
                          No production quantity codes added yet.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setShowAddCodes(true)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Line
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ===== STICKY FOOTER — totals ===== */}
          {provisionalAssemblies.length > 0 && (
            <div className="shrink-0 bg-white border-t-2" style={{ borderColor: "var(--figma-bg-outline)" }}>
              <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                <ColDefs />
                <tbody>
                  {/* Logged This Week */}
                  {weekHasCommitted && (
                    <tr className="h-10 bg-muted/10 border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                      <td className="px-4 text-xs font-semibold text-muted-foreground">
                        Logged This Week
                      </td>
                      {committedPerDay.map((hrs, i) => (
                        <React.Fragment key={`fcomm-${dateKeys[i]}`}>
                          <td
                            className={cn(
                              "text-center border-l",
                              dayBg(i)
                            )}
                            style={{ borderColor: "var(--figma-bg-outline)" }}
                          >
                            <span className="text-xs font-mono text-muted-foreground">
                              {hrs > 0 ? hrs.toFixed(1) : ""}
                            </span>
                          </td>
                          <td className={dayBg(i)} />
                        </React.Fragment>
                      ))}
                      <td className="text-center border-l-2 bg-muted/15" style={{ borderColor: "var(--figma-bg-outline)" }}>
                        <span className="text-xs font-mono font-semibold text-muted-foreground">
                          {committedPerDay.reduce((a, b) => a + b, 0) > 0
                            ? committedPerDay
                                .reduce((a, b) => a + b, 0)
                                .toFixed(1)
                            : ""}
                        </span>
                      </td>
                      <td className="bg-muted/15" />
                      <td className="border-l" style={{ borderColor: "var(--figma-bg-outline)" }} />
                      <td />
                    </tr>
                  )}

                  {/* Avg Daily Budget */}
                  <tr className="h-10 bg-muted/15 border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                    <td className="px-4 text-xs font-semibold text-muted-foreground">
                      Avg Daily Budget
                    </td>
                    {allocatedPerDay.map((alloc, i) => (
                      <React.Fragment key={`falloc-${dateKeys[i]}`}>
                        <td
                          className="text-center border-l"
                          style={{ borderColor: "var(--figma-bg-outline)" }}
                        >
                          <span className="text-xs font-mono text-muted-foreground">
                            {alloc > 0 ? alloc.toFixed(0) : ""}
                          </span>
                        </td>
                        <td />
                      </React.Fragment>
                    ))}
                    <td className="text-center border-l-2 bg-muted/20" style={{ borderColor: "var(--figma-bg-outline)" }}>
                      <span className="text-xs font-mono font-semibold text-muted-foreground">
                        {allocatedPerDay.reduce((a, b) => a + b, 0).toFixed(0)}
                      </span>
                    </td>
                    <td className="bg-muted/20" />
                    <td className="border-l" style={{ borderColor: "var(--figma-bg-outline)" }} />
                    <td />
                  </tr>

                  {/* Timecards Total */}
                  <tr className="h-10 bg-muted/25">
                    <td className="px-4 text-xs font-semibold">
                      Timecards Total
                    </td>
                    {timecardPerDay.map((tc, i) => (
                      <React.Fragment key={`ftc-${dateKeys[i]}`}>
                        <td
                          className="text-center border-l"
                          style={{ borderColor: "var(--figma-bg-outline)" }}
                        >
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
                        </td>
                        <td />
                      </React.Fragment>
                    ))}
                    <td className="text-center border-l-2 bg-muted/30" style={{ borderColor: "var(--figma-bg-outline)" }}>
                      <span
                        className={cn(
                          "text-xs font-mono font-semibold",
                          timecardPerDay.some((t) => t > 0)
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {timecardPerDay.reduce((a, b) => a + b, 0) > 0
                          ? timecardPerDay
                              .reduce((a, b) => a + b, 0)
                              .toFixed(0)
                          : ""}
                      </span>
                    </td>
                    <td className="bg-muted/30" />
                    <td className="border-l" style={{ borderColor: "var(--figma-bg-outline)" }} />
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar — Material Drawdown */}
        <div
          className="hidden xl:block w-[280px] shrink-0 border-l overflow-y-auto p-4"
          style={{ borderColor: "var(--figma-bg-outline)" }}
        >
          <MaterialDrawdown />
        </div>
      </div>

      <AddCodesModal open={showAddCodes} onOpenChange={setShowAddCodes} />
    </>
  );
}
