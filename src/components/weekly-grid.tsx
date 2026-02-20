"use client";

import React, { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Plus,
  Save,
  Search,
  Settings,
  Filter,
  MessageSquare,
  Wrench,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
const TABLE_MIN_W = W.code + 10 * W.cell + 2 * W.cell + W.pf + W.action;

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
  hasCommitted?: boolean;
}

function CellInput({ value, placeholder, onChange, small, hasCommitted }: CellInputProps) {
  return (
    <input
      type="number"
      value={value}
      placeholder={placeholder ?? "–"}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        cellInputBase,
        small && "h-7 text-xs",
        hasCommitted && !value && "placeholder:text-foreground placeholder:opacity-100"
      )}
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
  const [noteModalCode, setNoteModalCode] = useState<string | null>(null);
  const [claimingDrafts, setClaimingDrafts] = useState<
    Record<string, ClaimingProgress[]>
  >({});
  const [showAddCodes, setShowAddCodes] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
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

  const relevantMaterials = useMemo(() => {
    const items = new Set<string>();
    for (const a of provisionalAssemblies) {
      if (a?.materials) for (const m of a.materials) items.add(m.item);
    }
    return items;
  }, [provisionalAssemblies]);

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
    setNoteModalCode(null);
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
    setNoteModalCode(null);
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

  const pendingDrawdowns = useMemo(() => {
    const drawdowns: { item: string; qty: number }[] = [];
    for (const assembly of provisionalAssemblies) {
      if (!assembly) continue;
      let totalDraftUnits = 0;
      for (const dk of dateKeys) {
        const cell = drafts[assembly.wbs_code]?.[dk];
        if (cell) totalDraftUnits += parseFloat(cell.units) || 0;
      }
      if (totalDraftUnits > 0) {
        const d = calcMaterialDrawdown(assembly, totalDraftUnits);
        drawdowns.push(...d);
      }
    }
    const merged: { item: string; qty: number }[] = [];
    for (const d of drawdowns) {
      const existing = merged.find((m) => m.item === d.item);
      if (existing) existing.qty += d.qty;
      else merged.push({ ...d });
    }
    return merged;
  }, [provisionalAssemblies, dateKeys, drafts]);

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
          <button
            className={cn(
              "hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors",
              showSidebar
                ? "bg-neutral-800 text-white border-neutral-800 hover:bg-neutral-700"
                : "bg-white text-muted-foreground border hover:bg-muted/30"
            )}
            style={showSidebar ? undefined : { borderColor: "var(--figma-bg-outline)" }}
            onClick={() => setShowSidebar((v) => !v)}
          >
            {showSidebar ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            Inventory
          </button>
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
            <table className="border-collapse" style={{ tableLayout: "fixed", minWidth: TABLE_MIN_W }}>
              <ColDefs />

              {/* ===== HEADER ===== */}
              <thead className="sticky top-0 z-10">
                {/* Row 1: Day names + dates */}
                <tr className="bg-neutral-50 border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                  <th className="sticky left-0 z-20 bg-neutral-50 text-left px-4 py-2.5 text-xs font-semibold text-foreground border-r" style={{ borderColor: "var(--figma-bg-outline)" }}>
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
                    className="sticky z-20 bg-neutral-100 text-center py-2.5 border-l-2"
                    style={{ right: W.pf + W.action + W.cell, borderColor: "var(--figma-bg-outline)", boxShadow: "-4px 0 8px -4px rgba(0,0,0,0.06)" }}
                  >
                    <div className="text-xs font-semibold">Total</div>
                  </th>
                  <th
                    className="sticky z-20 bg-neutral-100 py-2.5"
                    style={{ right: W.pf + W.action }}
                  />
                  <th className="sticky z-20 bg-neutral-100 text-center py-2.5 text-xs font-semibold border-l" style={{ right: W.action, borderColor: "var(--figma-bg-outline)" }}>
                    PF
                  </th>
                  <th className="sticky right-0 z-20 bg-neutral-100 py-2.5" />
                </tr>

                {/* Row 2: Hours / Units sub-headers */}
                <tr className="bg-neutral-50 border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                  <th className="sticky left-0 z-20 bg-neutral-50 border-r" style={{ borderColor: "var(--figma-bg-outline)" }} />
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
                  <th className="sticky z-20 bg-neutral-100 text-center py-1.5 text-[10px] text-muted-foreground font-medium tracking-wider uppercase border-l-2" style={{ right: W.pf + W.action + W.cell, borderColor: "var(--figma-bg-outline)", boxShadow: "-4px 0 8px -4px rgba(0,0,0,0.06)" }}>
                    Hrs
                  </th>
                  <th className="sticky z-20 bg-neutral-100 text-center py-1.5 text-[10px] text-muted-foreground font-medium tracking-wider uppercase" style={{ right: W.pf + W.action }}>
                    Qty
                  </th>
                  <th className="sticky z-20 bg-neutral-100 border-l" style={{ right: W.action, borderColor: "var(--figma-bg-outline)" }} />
                  <th className="sticky right-0 z-20 bg-neutral-100" />
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
                                  hasCommitted={committed.hours > 0}
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
                                  hasCommitted={committed.units > 0}
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
                        <td className="sticky z-10 bg-neutral-50 group-hover:bg-sky-50/60 transition-colors border-l-2 text-center py-2 align-middle" style={{ right: W.pf + W.action + W.cell, borderColor: "var(--figma-bg-outline)", boxShadow: "-4px 0 8px -4px rgba(0,0,0,0.06)" }}>
                          <span className="text-sm font-mono font-semibold">
                            {rowTotals.totalHours > 0
                              ? rowTotals.totalHours.toFixed(1)
                              : ""}
                          </span>
                        </td>
                        {/* Total Units */}
                        <td className="sticky z-10 bg-neutral-50 group-hover:bg-sky-50/60 transition-colors text-center py-2 align-middle" style={{ right: W.pf + W.action }}>
                          <span className="text-sm font-mono font-semibold">
                            {rowTotals.totalUnits > 0
                              ? rowTotals.totalUnits.toFixed(1)
                              : ""}
                          </span>
                        </td>

                        {/* PF */}
                        <td className="sticky z-10 bg-neutral-50 group-hover:bg-sky-50/60 transition-colors text-center border-l align-middle" style={{ right: W.action, borderColor: "var(--figma-bg-outline)" }}>
                          <PFBadge pf={pf} hasData={agg.totalHours > 0} />
                        </td>

                        {/* Notes */}
                        <td className="sticky right-0 z-10 bg-neutral-50 group-hover:bg-sky-50/60 transition-colors text-center align-middle">
                          <button
                            onClick={() => setNoteModalCode(assembly.wbs_code)}
                            className={cn(
                              "p-1.5 rounded transition-colors",
                              rowNote || latestNote
                                ? "text-primary hover:bg-primary/10"
                                : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/30"
                            )}
                            title="Add note"
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
                          <div className="flex items-start gap-1.5 pl-6">
                            <Wrench className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-[11px] text-muted-foreground">
                                Equipment Hrs
                              </span>
                              {assembly.equipment && assembly.equipment.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {assembly.equipment.map((eq) => (
                                    <span
                                      key={eq.name}
                                      className="inline-flex items-center rounded bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                    >
                                      {eq.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
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
                                  hasCommitted={ce > 0}
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
                        <td className="sticky z-10 bg-neutral-50 border-l-2" style={{ right: W.pf + W.action + W.cell, borderColor: "var(--figma-bg-outline)", boxShadow: "-4px 0 8px -4px rgba(0,0,0,0.06)" }} />
                        <td className="sticky z-10 bg-neutral-50" style={{ right: W.pf + W.action }} />
                        <td className="sticky z-10 bg-neutral-50 border-l" style={{ right: W.action, borderColor: "var(--figma-bg-outline)" }} />
                        <td className="sticky right-0 z-10 bg-neutral-50" />
                      </tr>
                      {/* ======== CLAIMING SUB-GRID ======== */}
                      {isExpanded && hasSchema && schema && (
                        <tr className="border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                          <td colSpan={15} className="bg-gradient-to-b from-muted/[0.06] to-transparent">
                            <div className="sticky left-0 w-fit">
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
                        <Settings className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm">
                          No production quantity codes added yet.
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          Set up provisional codes first, or add a line directly.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                          <Button asChild variant="outline" size="sm" className="gap-1.5">
                            <Link href="/setup">
                              <Settings className="h-3.5 w-3.5" />
                              Go to Setup
                            </Link>
                          </Button>
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
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
          </table>

          {/* ===== STICKY FOOTER — totals ===== */}
          {provisionalAssemblies.length > 0 && (
            <div className="sticky bottom-0 z-10 bg-white border-t-2" style={{ borderColor: "var(--figma-bg-outline)" }}>
              <table className="border-collapse" style={{ tableLayout: "fixed", minWidth: TABLE_MIN_W }}>
                <ColDefs />
                <tbody>
                  {/* Logged This Week */}
                  {weekHasCommitted && (
                    <tr className="h-10 bg-neutral-50 border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                      <td className="sticky left-0 z-20 bg-neutral-50 px-4 text-xs font-semibold text-muted-foreground border-r" style={{ width: W.code, borderColor: "var(--figma-bg-outline)" }}>
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
                    <td className="sticky z-20 bg-neutral-100 text-center border-l-2" style={{ right: W.pf + W.action + W.cell, borderColor: "var(--figma-bg-outline)", boxShadow: "-4px 0 8px -4px rgba(0,0,0,0.06)" }}>
                      <span className="text-xs font-mono font-semibold text-muted-foreground">
                        {committedPerDay.reduce((a, b) => a + b, 0) > 0
                          ? committedPerDay
                              .reduce((a, b) => a + b, 0)
                              .toFixed(1)
                          : ""}
                      </span>
                    </td>
                    <td className="sticky z-20 bg-neutral-100" style={{ right: W.pf + W.action }} />
                      <td className="sticky z-20 bg-neutral-100 border-l" style={{ right: W.action, borderColor: "var(--figma-bg-outline)" }} />
                      <td className="sticky right-0 z-20 bg-neutral-100" />
                    </tr>
                  )}

                  {/* Avg Daily Budget */}
                <tr className="h-10 bg-neutral-50 border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
                  <td className="sticky left-0 z-20 bg-neutral-50 px-4 text-xs font-semibold text-muted-foreground border-r" style={{ width: W.code, borderColor: "var(--figma-bg-outline)" }}>
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
                  <td className="sticky z-20 bg-neutral-100 text-center border-l-2" style={{ right: W.pf + W.action + W.cell, borderColor: "var(--figma-bg-outline)", boxShadow: "-4px 0 8px -4px rgba(0,0,0,0.06)" }}>
                    <span className="text-xs font-mono font-semibold text-muted-foreground">
                      {allocatedPerDay.reduce((a, b) => a + b, 0).toFixed(0)}
                    </span>
                  </td>
                  <td className="sticky z-20 bg-neutral-100" style={{ right: W.pf + W.action }} />
                    <td className="sticky z-20 bg-neutral-100 border-l" style={{ right: W.action, borderColor: "var(--figma-bg-outline)" }} />
                    <td className="sticky right-0 z-20 bg-neutral-100" />
                  </tr>

                  {/* Timecards Total */}
                <tr className="h-10 bg-neutral-100">
                  <td className="sticky left-0 z-20 bg-neutral-100 px-4 text-xs font-semibold border-r" style={{ width: W.code, borderColor: "var(--figma-bg-outline)" }}>
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
                  <td className="sticky z-20 bg-neutral-200 text-center border-l-2" style={{ right: W.pf + W.action + W.cell, borderColor: "var(--figma-bg-outline)", boxShadow: "-4px 0 8px -4px rgba(0,0,0,0.06)" }}>
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
                  <td className="sticky z-20 bg-neutral-200" style={{ right: W.pf + W.action }} />
                    <td className="sticky z-20 bg-neutral-200 border-l" style={{ right: W.action, borderColor: "var(--figma-bg-outline)" }} />
                    <td className="sticky right-0 z-20 bg-neutral-200" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        </div>

        {/* Sidebar — Material Drawdown */}
        <div
          className={cn(
            "hidden xl:block shrink-0 border-l overflow-hidden transition-[width] duration-200 ease-in-out",
            showSidebar ? "w-[280px]" : "w-0 border-l-0"
          )}
          style={{ borderColor: showSidebar ? "var(--figma-bg-outline)" : "transparent" }}
        >
          <div className="w-[280px] h-full overflow-y-auto p-4">
            <MaterialDrawdown pendingDrawdowns={pendingDrawdowns} relevantItems={relevantMaterials} />
          </div>
        </div>
      </div>

      {/* ======== NOTES MODAL ======== */}
      <Dialog open={noteModalCode !== null} onOpenChange={(open) => { if (!open) setNoteModalCode(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Variance Notes</DialogTitle>
            {noteModalCode && (
              <DialogDescription>
                {assemblies.find((a) => a.wbs_code === noteModalCode)?.description}
                <span className="font-mono text-[11px] ml-1.5 opacity-60">{noteModalCode}</span>
              </DialogDescription>
            )}
          </DialogHeader>
          {noteModalCode && (() => {
            const draft = notesDraft[noteModalCode] ?? "";
            const prev = productionEvents
              .filter((e) => e.wbs_code === noteModalCode && e.description)
              .map((e) => e.description)
              .filter(Boolean)
              .at(-1) ?? "";
            return (
              <div className="space-y-3">
                {prev && !draft && (
                  <p className="text-sm text-muted-foreground italic">
                    Previous: {prev}
                  </p>
                )}
                <Textarea
                  placeholder="Variance notes, constraints, field conditions..."
                  maxLength={255}
                  value={draft}
                  onChange={(e) => {
                    setNotesDraft((p) => ({ ...p, [noteModalCode]: e.target.value }));
                    setSaved(false);
                  }}
                  className="text-sm resize-none min-h-[80px]"
                  rows={3}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-right">
                  {draft.length}/255
                </p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AddCodesModal open={showAddCodes} onOpenChange={setShowAddCodes} />
    </>
  );
}
