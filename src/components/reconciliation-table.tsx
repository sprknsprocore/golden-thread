"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Flag,
  MessageSquare,
  Pencil,
  Settings,
  TrendingDown,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { PFBadge } from "@/components/pf-badge";
import {
  useProductionStore,
  type Assembly,
  type TrueUpStatus,
  type VarianceReason,
  VARIANCE_REASONS,
} from "@/store/use-production-store";
import {
  aggregateEvents,
  calcEarnedHours,
  calcSimplePercentComplete,
  calcClaimingPercentComplete,
  calcPerformanceFactor,
  calcInlineECAC,
  calcReverseRate,
  isClaimingStale,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";

/* ---------- Helpers ---------- */

function fmt(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const statusConfig: Record<TrueUpStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-muted/50 text-muted-foreground border-muted-foreground/30",
  },
  accepted: {
    label: "Accepted",
    className: "bg-green-50 text-green-700 border-green-500",
  },
  adjusted: {
    label: "Adjusted",
    className: "bg-blue-50 text-blue-700 border-blue-500",
  },
  flagged: {
    label: "Flagged",
    className: "bg-amber-50 text-amber-700 border-amber-500",
  },
};

/* ---------- Per-code computed data ---------- */

interface CodeData {
  assembly: Assembly;
  fieldQty: number;
  fieldHours: number;
  fieldEquipHours: number;
  pctComplete: number;
  earnedHours: number;
  pf: number;
  budgetedCost: number;
  projectedCost: number;
  ecac: number;
  ecacVariance: number;
  ecacRequiredRate: number;
  ecacCurrentRate: number;
  ecacRemainingQty: number;
  status: TrueUpStatus;
  fieldNotes: { date: string; note: string }[];
  dailyBreakdown: { date: string; hours: number; qty: number; equipHours: number; source: string; note: string }[];
  stale: boolean;
}

/* ---------- Main Component ---------- */

interface ReconciliationTableProps {
  statusFilter?: "all" | "pending" | "flagged" | "reviewed";
}

export function ReconciliationTable({ statusFilter = "all" }: ReconciliationTableProps) {
  const {
    assemblies,
    provisionalCodes,
    productionEvents,
    claimingSchemas,
    pmOverrides,
    trueUpStatuses,
    ecacOverrides,
    setPmOverride,
    setTrueUpStatus,
    setEcacOverride,
  } = useProductionStore();

  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [showDailyBreakdown, setShowDailyBreakdown] = useState<Record<string, boolean>>({});

  const provisionalAssemblies = provisionalCodes
    .map((code) => assemblies.find((a) => a.wbs_code === code))
    .filter(Boolean) as Assembly[];

  /* ---------- Compute per-code data ---------- */

  const codeDataList: CodeData[] = useMemo(() => {
    return provisionalAssemblies.map((assembly) => {
      const agg = aggregateEvents(productionEvents, assembly.wbs_code);
      const override = pmOverrides.find((o) => o.wbs_code === assembly.wbs_code);
      const effectiveQty = override?.validated_qty ?? agg.totalQty;
      const effectiveHours = override?.validated_hours ?? agg.totalHours;

      const schema = assembly.claiming_schema_id
        ? claimingSchemas[assembly.claiming_schema_id]
        : null;

      let pctComplete: number;
      if (schema) {
        const latestEvent = productionEvents
          .filter((e) => e.wbs_code === assembly.wbs_code)
          .at(-1);
        pctComplete = latestEvent
          ? calcClaimingPercentComplete(schema, latestEvent.claiming_progress)
          : 0;
      } else {
        pctComplete = calcSimplePercentComplete(effectiveQty, assembly.budgeted_qty);
      }

      const stale = assembly.claiming_schema_id
        ? isClaimingStale(productionEvents, assembly.wbs_code)
        : false;

      const earnedHours = calcEarnedHours(assembly.budgeted_hours, pctComplete);
      const pf = calcPerformanceFactor(earnedHours, effectiveHours);
      const budgetedCost = assembly.budgeted_qty * assembly.blended_unit_cost;
      const ecacData = calcInlineECAC(
        assembly.budgeted_qty,
        effectiveQty,
        assembly.budgeted_hours,
        effectiveHours,
        assembly.blended_unit_cost
      );

      const fieldNotes = productionEvents
        .filter((e) => e.wbs_code === assembly.wbs_code && e.description.trim() !== "")
        .map((e) => ({ date: e.date, note: e.description }));

      // Daily breakdown of individual events
      const dailyBreakdown = productionEvents
        .filter((e) => e.wbs_code === assembly.wbs_code)
        .map((e) => ({
          date: e.date,
          hours: e.actual_hours,
          qty: e.actual_qty,
          equipHours: e.equipment_hours,
          source: e.source,
          note: e.description,
        }));

      // Equipment hours from events
      const fieldEquipHours = productionEvents
        .filter((e) => e.wbs_code === assembly.wbs_code)
        .reduce((sum, e) => sum + e.equipment_hours, 0);

      return {
        assembly,
        fieldQty: agg.totalQty,
        fieldHours: agg.totalHours,
        fieldEquipHours,
        pctComplete,
        earnedHours,
        pf,
        budgetedCost,
        projectedCost: effectiveQty * assembly.blended_unit_cost,
        ecac: ecacData.ecac,
        ecacVariance: ecacData.ecac - budgetedCost,
        ecacRequiredRate: ecacData.requiredRate,
        ecacCurrentRate: ecacData.currentRate,
        ecacRemainingQty: ecacData.remainingQty,
        status: trueUpStatuses[assembly.wbs_code] ?? "pending",
        fieldNotes,
        dailyBreakdown,
        stale,
      };
    });
  }, [provisionalAssemblies, productionEvents, pmOverrides, claimingSchemas, trueUpStatuses]);

  /* ---------- Sort by urgency + filter ---------- */

  const sortedCodes = useMemo(() => {
    const statusOrder: Record<TrueUpStatus, number> = {
      flagged: 0,
      pending: 1,
      adjusted: 2,
      accepted: 3,
    };
    const sorted = [...codeDataList].sort((a, b) => {
      const sDiff = statusOrder[a.status] - statusOrder[b.status];
      if (sDiff !== 0) return sDiff;
      const aPf = a.fieldHours > 0 ? a.pf : 999;
      const bPf = b.fieldHours > 0 ? b.pf : 999;
      return aPf - bPf;
    });
    if (statusFilter === "all") return sorted;
    if (statusFilter === "pending") return sorted.filter((d) => d.status === "pending");
    if (statusFilter === "flagged") return sorted.filter((d) => d.status === "flagged");
    // "reviewed" = accepted or adjusted
    return sorted.filter((d) => d.status === "accepted" || d.status === "adjusted");
  }, [codeDataList, statusFilter]);

  /* ---------- Summary totals ---------- */

  const summary = useMemo(() => {
    let totalBudget = 0;
    let totalECAC = 0;
    let totalEarned = 0;
    let totalActual = 0;
    let reviewed = 0;
    let flagged = 0;

    for (const d of codeDataList) {
      totalBudget += d.budgetedCost;
      totalECAC += d.ecac;
      totalEarned += d.earnedHours;
      totalActual += d.fieldHours;
      if (d.status !== "pending") reviewed++;
      if (d.status === "flagged") flagged++;
    }

    const overallPf = totalActual > 0 ? totalEarned / totalActual : 0;
    const ecacVariance = totalECAC - totalBudget;
    const total = codeDataList.length;
    const hasData = totalActual > 0;

    return { totalBudget, totalECAC, ecacVariance, overallPf, reviewed, flagged, total, hasData };
  }, [codeDataList]);

  /* ---------- Actions ---------- */

  const handleAccept = (wbsCode: string) => {
    const d = codeDataList.find((c) => c.assembly.wbs_code === wbsCode);
    if (!d) return;
    const existing = pmOverrides.find((o) => o.wbs_code === wbsCode);
    setPmOverride({
      wbs_code: wbsCode,
      validated_qty: d.fieldQty,
      validated_hours: d.fieldHours,
      variance_reasons: existing?.variance_reasons ?? [],
      variance_note: existing?.variance_note ?? "",
    });
    setTrueUpStatus(wbsCode, "accepted");
    if (expandedCode === wbsCode) setExpandedCode(null);
    toast.success(`${d.assembly.description} accepted`);
  };

  const handleFlag = (wbsCode: string) => {
    const current = trueUpStatuses[wbsCode] ?? "pending";
    const next = current === "flagged" ? "pending" : "flagged";
    setTrueUpStatus(wbsCode, next);
    const desc = codeDataList.find((c) => c.assembly.wbs_code === wbsCode)?.assembly.description ?? wbsCode;
    if (next === "flagged") {
      toast.warning(`${desc} flagged for follow-up`);
    } else {
      toast.info(`${desc} flag removed`);
    }
  };

  const handleExpand = (wbsCode: string) => {
    setExpandedCode(expandedCode === wbsCode ? null : wbsCode);
  };

  /* ---------- Empty states ---------- */

  if (provisionalAssemblies.length === 0) {
    return (
      <div className="text-center py-16">
        <Settings className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">No provisional codes to reconcile.</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Set up your production codes first, then capture field data.
        </p>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/setup">
            <Settings className="h-3.5 w-3.5" />
            Go to Setup
          </Link>
        </Button>
      </div>
    );
  }

  if (!summary.hasData) {
    return (
      <div className="text-center py-16">
        <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">No field data to reconcile yet.</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          {provisionalAssemblies.length} codes are ready. Capture production data first.
        </p>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/capture">
            <ClipboardList className="h-3.5 w-3.5" />
            Go to Capture
          </Link>
        </Button>
      </div>
    );
  }

  /* ---------- Render ---------- */

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ECAC vs Budget */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">ECAC vs Budget</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{fmt(summary.totalECAC)}</p>
            <p className={cn(
              "text-xs font-mono mt-1",
              summary.ecacVariance <= 0 ? "text-green-600" : "text-red-600"
            )}>
              {summary.ecacVariance > 0 ? "+" : ""}{fmt(summary.ecacVariance)} vs {fmt(summary.totalBudget)} budget
            </p>
          </CardContent>
        </Card>

        {/* Review Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Review Progress</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {summary.reviewed}<span className="text-sm font-normal text-muted-foreground"> / {summary.total}</span>
            </p>
            <Progress
              value={summary.total > 0 ? (summary.reviewed / summary.total) * 100 : 0}
              className="h-1.5 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {summary.total - summary.reviewed === 0
                ? "All codes reviewed"
                : `${summary.total - summary.reviewed} remaining`}
            </p>
          </CardContent>
        </Card>

        {/* Performance Factor */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Overall Performance Factor</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold font-mono",
              summary.overallPf >= 1 ? "text-green-600" : "text-red-600"
            )}>
              {summary.overallPf.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.overallPf >= 1 ? "Earning more than spending" : "Spending more than earning"}
            </p>
          </CardContent>
        </Card>

        {/* Flags */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Flags</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold font-mono",
              summary.flagged > 0 ? "text-amber-600" : "text-muted-foreground"
            )}>
              {summary.flagged}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.flagged === 0
                ? "No codes flagged for follow-up"
                : `${summary.flagged} code${summary.flagged > 1 ? "s" : ""} need follow-up`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Review Queue */}
      <div className="space-y-2">
        {sortedCodes.map((d) => (
          <CodeReviewCard
            key={d.assembly.wbs_code}
            data={d}
            isExpanded={expandedCode === d.assembly.wbs_code}
            override={pmOverrides.find((o) => o.wbs_code === d.assembly.wbs_code)}
            ecacOverrideValue={ecacOverrides[d.assembly.wbs_code] ?? ""}
            showBreakdown={showDailyBreakdown[d.assembly.wbs_code] ?? false}
            onToggleBreakdown={() =>
              setShowDailyBreakdown((prev) => ({
                ...prev,
                [d.assembly.wbs_code]: !prev[d.assembly.wbs_code],
              }))
            }
            onEcacOverrideChange={(val) => setEcacOverride(d.assembly.wbs_code, val)}
            onAccept={() => handleAccept(d.assembly.wbs_code)}
            onFlag={() => handleFlag(d.assembly.wbs_code)}
            onExpand={() => handleExpand(d.assembly.wbs_code)}
            onOverrideChange={(field, value) => {
              const existing = pmOverrides.find((o) => o.wbs_code === d.assembly.wbs_code);
              setPmOverride({
                wbs_code: d.assembly.wbs_code,
                validated_qty: field === "qty" ? value : (existing?.validated_qty ?? d.fieldQty),
                validated_hours: field === "hours" ? value : (existing?.validated_hours ?? d.fieldHours),
                variance_reasons: existing?.variance_reasons ?? [],
                variance_note: existing?.variance_note ?? "",
              });
            }}
            onReasonsChange={(reasons) => {
              const existing = pmOverrides.find((o) => o.wbs_code === d.assembly.wbs_code);
              setPmOverride({
                wbs_code: d.assembly.wbs_code,
                validated_qty: existing?.validated_qty ?? d.fieldQty,
                validated_hours: existing?.validated_hours ?? d.fieldHours,
                variance_reasons: reasons,
                variance_note: existing?.variance_note ?? "",
              });
            }}
            onNoteChange={(note) => {
              const existing = pmOverrides.find((o) => o.wbs_code === d.assembly.wbs_code);
              setPmOverride({
                wbs_code: d.assembly.wbs_code,
                validated_qty: existing?.validated_qty ?? d.fieldQty,
                validated_hours: existing?.validated_hours ?? d.fieldHours,
                variance_reasons: existing?.variance_reasons ?? [],
                variance_note: note,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   CodeReviewCard — collapsed + expanded states
   ================================================================ */

interface CodeReviewCardProps {
  data: CodeData;
  isExpanded: boolean;
  override: { validated_qty: number; validated_hours: number; variance_reasons: VarianceReason[]; variance_note: string } | undefined;
  ecacOverrideValue: string;
  showBreakdown: boolean;
  onToggleBreakdown: () => void;
  onEcacOverrideChange: (val: string) => void;
  onAccept: () => void;
  onFlag: () => void;
  onExpand: () => void;
  onOverrideChange: (field: "qty" | "hours", value: number) => void;
  onReasonsChange: (reasons: VarianceReason[]) => void;
  onNoteChange: (note: string) => void;
}

function CodeReviewCard({
  data,
  isExpanded,
  override,
  ecacOverrideValue,
  showBreakdown,
  onToggleBreakdown,
  onEcacOverrideChange,
  onAccept,
  onFlag,
  onExpand,
  onOverrideChange,
  onReasonsChange,
  onNoteChange,
}: CodeReviewCardProps) {
  const { assembly, fieldQty, fieldHours, pf, ecac, budgetedCost, status, stale } = data;
  const cfg = statusConfig[status];

  // Reverse calc
  const actualCostToDate = fieldQty * assembly.blended_unit_cost;
  const originalBudget = assembly.budgeted_qty * assembly.blended_unit_cost;
  const ecacVal = parseFloat(ecacOverrideValue);
  const reverseResult =
    !isNaN(ecacVal) && fieldQty > 0
      ? calcReverseRate(
          assembly.budgeted_qty,
          override?.validated_qty ?? fieldQty,
          assembly.budgeted_hours,
          override?.validated_hours ?? fieldHours,
          ecacVal,
          assembly.blended_unit_cost,
          actualCostToDate
        )
      : null;

  const selectedReasons = override?.variance_reasons ?? [];

  const toggleReason = (reason: VarianceReason) => {
    if (selectedReasons.includes(reason)) {
      onReasonsChange(selectedReasons.filter((r) => r !== reason));
    } else {
      onReasonsChange([...selectedReasons, reason]);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-white transition-shadow",
        status === "flagged" && "border-amber-300 shadow-sm shadow-amber-100",
        status === "pending" && fieldHours > 0 && pf < 1 && "border-red-200",
        isExpanded && "shadow-md"
      )}
    >
      {/* ---- Collapsed row ---- */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Expand toggle */}
        <button
          onClick={onExpand}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{assembly.description}</p>
          <p className="text-[11px] text-muted-foreground font-mono">{assembly.wbs_code}</p>
        </div>

        {/* Field summary */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          <div className="text-right">
            <span className="font-mono">{fieldQty > 0 ? fieldQty.toLocaleString() : "—"}</span>
            <span className="ml-1">{assembly.uom}</span>
          </div>
          <div className="text-right">
            <span className="font-mono">{fieldHours > 0 ? fieldHours.toFixed(1) : "—"}</span>
            <span className="ml-1">hrs</span>
          </div>
        </div>

        {/* PF Badge */}
        <div className="shrink-0 w-16 text-center">
          <PFBadge pf={pf} hasData={fieldHours > 0} isStale={stale} />
        </div>

        {/* ECAC Badge */}
        <div className="shrink-0 w-20 text-right">
          {fieldHours > 0 ? (
            <span
              className={cn(
                "text-xs font-mono",
                ecac > budgetedCost * 1.02
                  ? "text-red-600 font-semibold"
                  : ecac < budgetedCost * 0.98
                  ? "text-green-600 font-semibold"
                  : "text-muted-foreground"
              )}
            >
              {fmt(ecac)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        {/* Status badge */}
        <Badge variant="outline" className={cn("text-[10px] shrink-0 w-20 justify-center", cfg.className)}>
          {cfg.label}
        </Badge>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              status === "accepted" && "text-green-600"
            )}
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
            title="Accept field data"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            title="Adjust"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7",
              status === "flagged" && "text-amber-600 bg-amber-50"
            )}
            onClick={(e) => { e.stopPropagation(); onFlag(); }}
            title="Flag for follow-up"
          >
            <Flag className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ---- Expanded detail panel ---- */}
      {isExpanded && (
        <div className="border-t bg-muted/5 px-4 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Field vs PM Assessment */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Field Data vs Your Assessment
              </h4>

              {/* Side-by-side inputs */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {/* Qty */}
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Field Quantity</label>
                  <p className="text-lg font-mono font-semibold mt-0.5">
                    {fieldQty.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{assembly.uom}</span>
                  </p>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Validated Quantity</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Input
                      type="number"
                      placeholder={fieldQty.toString()}
                      value={override?.validated_qty ?? ""}
                      onChange={(e) => onOverrideChange("qty", parseFloat(e.target.value) || 0)}
                      className="h-9 text-right font-mono w-28"
                    />
                    <span className="text-xs text-muted-foreground">{assembly.uom}</span>
                  </div>
                </div>

                {/* Hours */}
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Field Hours</label>
                  <p className="text-lg font-mono font-semibold mt-0.5">
                    {fieldHours.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">hrs</span>
                  </p>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Validated Hours</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Input
                      type="number"
                      placeholder={fieldHours.toFixed(1)}
                      value={override?.validated_hours ?? ""}
                      onChange={(e) => onOverrideChange("hours", parseFloat(e.target.value) || 0)}
                      className="h-9 text-right font-mono w-28"
                    />
                    <span className="text-xs text-muted-foreground">hrs</span>
                  </div>
                </div>

                {/* Equipment hours (read-only) */}
                {data.fieldEquipHours > 0 && (
                  <>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Equipment Hours</label>
                      <p className="text-lg font-mono font-semibold mt-0.5">
                        {data.fieldEquipHours.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">hrs</span>
                      </p>
                    </div>
                    <div />
                  </>
                )}
              </div>

              {/* Daily Breakdown (collapsible) */}
              {data.dailyBreakdown.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={onToggleBreakdown}
                    className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showBreakdown ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="font-semibold uppercase tracking-wider">
                      Daily Breakdown ({data.dailyBreakdown.length} entries)
                    </span>
                  </button>
                  {showBreakdown && (
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/10">
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                            <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Hours</th>
                            <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Qty</th>
                            <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Equip</th>
                            <th className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">Source</th>
                            <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.dailyBreakdown.map((entry, i) => (
                            <tr key={i} className="border-t h-10">
                              <td className="px-2 py-1.5 font-mono">{entry.date}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{entry.hours.toFixed(1)}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{entry.qty}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{entry.equipHours > 0 ? entry.equipHours.toFixed(1) : "—"}</td>
                              <td className="px-2 py-1.5 text-center">
                                <Badge variant="outline" className="text-[9px] font-normal">
                                  {entry.source}
                                </Badge>
                              </td>
                              <td className="px-2 py-1.5 text-muted-foreground max-w-[200px] truncate">
                                {entry.note || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Field notes timeline */}
              {data.fieldNotes.length > 0 && !showBreakdown && (
                <div className="mt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Field Notes
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {data.fieldNotes.map((n, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground font-mono shrink-0 w-20">{n.date}</span>
                        <span className="text-foreground">{n.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Budget Impact + Reverse Calc */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Budget Impact & Forecast
              </h4>

              {/* Budget metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-md border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Budgeted</p>
                  <p className="text-sm font-mono font-semibold mt-0.5">{fmt(data.budgetedCost)}</p>
                </div>
                <div className="bg-white rounded-md border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Projected</p>
                  <p className="text-sm font-mono font-semibold mt-0.5">{fmt(data.projectedCost)}</p>
                </div>
                <div className={cn(
                  "rounded-md border p-3",
                  data.ecacVariance > data.budgetedCost * 0.02
                    ? "bg-red-50/50 border-red-200"
                    : data.ecacVariance < -data.budgetedCost * 0.02
                    ? "bg-green-50/50 border-green-200"
                    : "bg-white"
                )}>
                  <p className="text-[10px] text-muted-foreground uppercase">ECAC</p>
                  <p className={cn(
                    "text-sm font-mono font-semibold mt-0.5",
                    data.ecacVariance > data.budgetedCost * 0.02
                      ? "text-red-600"
                      : data.ecacVariance < -data.budgetedCost * 0.02
                      ? "text-green-600"
                      : ""
                  )}>
                    {fmt(data.ecac)}
                  </p>
                </div>
              </div>

              {/* Rate comparison */}
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Current rate: </span>
                  <span className="font-mono font-semibold">
                    {data.ecacCurrentRate > 0 ? data.ecacCurrentRate.toFixed(3) : "—"} {assembly.uom}/hr
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Required: </span>
                  <span className="font-mono font-semibold">
                    {data.ecacRequiredRate > 0 ? data.ecacRequiredRate.toFixed(3) : "—"} {assembly.uom}/hr
                  </span>
                </div>
              </div>

              {/* Inline Reverse Calculator */}
              <div className="bg-white rounded-md border p-3 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Reverse Calculator
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">If ECAC =</span>
                  <Input
                    type="number"
                    placeholder={originalBudget.toFixed(0)}
                    value={ecacOverrideValue}
                    onChange={(e) => onEcacOverrideChange(e.target.value)}
                    className="h-8 w-32 font-mono text-sm"
                  />
                </div>
                {reverseResult && (
                  <div className="bg-muted/30 rounded p-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-semibold font-mono">
                        {reverseResult.requiredRate.toFixed(3)} {assembly.uom}/hr
                      </span>
                      <span className="text-xs text-muted-foreground">required</span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span>Remaining: {reverseResult.remainingQty.toLocaleString()} {assembly.uom}</span>
                      <span>Budget hrs left: {reverseResult.remainingHours.toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full-width: Variance Reasons + Note */}
          <div className="mt-5 pt-4 border-t">
            {/* Structured variance reasons */}
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Variance Reasons
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 mb-3">
              {VARIANCE_REASONS.map((reason) => {
                const isSelected = selectedReasons.includes(reason);
                return (
                  <button
                    key={reason}
                    onClick={() => toggleReason(reason)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-colors",
                      isSelected
                        ? "bg-primary/10 border-primary/40 text-primary font-medium"
                        : "bg-white border-muted-foreground/20 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>

            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              PM Variance Note
            </label>
            <Textarea
              placeholder="Document your assessment, reasons for adjustment, follow-up items..."
              maxLength={255}
              value={override?.variance_note ?? ""}
              onChange={(e) => onNoteChange(e.target.value)}
              className="mt-1.5 text-sm resize-none"
              rows={3}
            />
            <p className="text-[10px] text-muted-foreground text-right mt-1">
              {(override?.variance_note ?? "").length}/255
            </p>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              {status === "flagged" && (
                <Badge variant="outline" className="text-xs gap-1 border-amber-500 text-amber-700 bg-amber-50">
                  <AlertTriangle className="h-3 w-3" />
                  Flagged for follow-up
                </Badge>
              )}
              {status === "accepted" && (
                <Badge variant="outline" className="text-xs gap-1 border-green-500 text-green-700 bg-green-50">
                  <CheckCircle2 className="h-3 w-3" />
                  Field data accepted
                </Badge>
              )}
              {status === "adjusted" && (
                <Badge variant="outline" className="text-xs gap-1 border-blue-500 text-blue-700 bg-blue-50">
                  <Pencil className="h-3 w-3" />
                  PM adjusted
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={onAccept}
              >
                <Check className="h-3.5 w-3.5" />
                Accept as-is
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-1.5 text-xs",
                  status === "flagged" && "border-amber-500 text-amber-700 bg-amber-50"
                )}
                onClick={onFlag}
              >
                <Flag className="h-3.5 w-3.5" />
                {status === "flagged" ? "Remove Flag" : "Flag for Follow-Up"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
