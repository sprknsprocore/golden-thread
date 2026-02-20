"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, CornerDownRight, Filter, BarChart3, Settings, Search, TrendingUp, TrendingDown, Minus, X, List, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PFBadge } from "@/components/pf-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProductionStore } from "@/store/use-production-store";
import {
  aggregateEvents,
  calcEarnedHours,
  calcSimplePercentComplete,
  calcPerformanceFactor,
  calcClaimingPercentComplete,
  isClaimingStale,
} from "@/lib/calculations";
import { calcAllComponents } from "@/lib/work-package-calculations";
import { cn } from "@/lib/utils";

function fmt(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BudgetPage() {
  const {
    assemblies,
    provisionalCodes,
    productionEvents,
    claimingSchemas,
    projectMetadata,
  } = useProductionStore();

  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [expandedWbs, setExpandedWbs] = useState<Set<string>>(new Set());

  const toggleExpand = (wbs: string) => {
    setExpandedWbs((prev) => {
      const next = new Set(prev);
      if (next.has(wbs)) next.delete(wbs);
      else next.add(wbs);
      return next;
    });
  };

  // Compute totals
  let totalBudgetedHours = 0;
  let totalActualHours = 0;
  let totalOriginalBudget = 0;
  let totalRevisedBudget = 0;
  let totalDirectCosts = 0;
  let totalJTD = 0;
  let totalProjectedCosts = 0;
  let totalEarnedHours = 0;

  const assemblyRows = assemblies.map((assembly) => {
    const isProvisional = provisionalCodes.includes(assembly.wbs_code);
    const agg = aggregateEvents(productionEvents, assembly.wbs_code);
    let pctComplete: number;
    if (assembly.claiming_schema_id && claimingSchemas[assembly.claiming_schema_id]) {
      const events = productionEvents.filter(
        (e) => e.wbs_code === assembly.wbs_code
      );
      const latestEvent = events[events.length - 1];
      pctComplete = latestEvent
        ? calcClaimingPercentComplete(
            claimingSchemas[assembly.claiming_schema_id],
            latestEvent.claiming_progress
          )
        : 0;
    } else {
      pctComplete = calcSimplePercentComplete(
        agg.totalQty,
        assembly.budgeted_qty
      );
    }

    const stale = assembly.claiming_schema_id
      ? isClaimingStale(productionEvents, assembly.wbs_code)
      : false;

    const earnedHours = calcEarnedHours(assembly.budgeted_hours, pctComplete);
    const pf = calcPerformanceFactor(earnedHours, agg.totalHours);

    // Procore-style budget columns
    const originalBudget = assembly.budgeted_qty * assembly.blended_unit_cost;
    const approvedChanges = 0;
    const revisedBudget = originalBudget + approvedChanges;
    const committedCosts = 0;
    const directCosts = agg.totalQty * assembly.blended_unit_cost;
    const jtdCosts = committedCosts + directCosts;
    const pendingCostChanges = 0;
    const projectedCost =
      pctComplete > 0
        ? directCosts / pctComplete
        : originalBudget;

    totalBudgetedHours += assembly.budgeted_hours;
    totalActualHours += agg.totalHours;
    totalOriginalBudget += originalBudget;
    totalRevisedBudget += revisedBudget;
    totalDirectCosts += directCosts;
    totalJTD += jtdCosts;
    totalProjectedCosts += projectedCost;
    totalEarnedHours += earnedHours;

    return {
      assembly,
      isProvisional,
      agg,
      pctComplete,
      pf,
      stale,
      originalBudget,
      approvedChanges,
      revisedBudget,
      committedCosts,
      directCosts,
      jtdCosts,
      pendingCostChanges,
      projectedCost,
    };
  });

  const filteredRows = showActiveOnly
    ? assemblyRows.filter((r) => r.isProvisional)
    : assemblyRows;

  const overallPF = calcPerformanceFactor(totalEarnedHours, totalActualHours);

  return (
    <TooltipProvider>
    <div className="flex flex-col h-full">

      {/* ============================================================ */}
      {/* PAGE HEADER                                                   */}
      {/* ============================================================ */}
      <div className="shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            Home &middot; {projectMetadata.name} &middot; Financial Management
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Budget</h1>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 opacity-50 cursor-not-allowed" disabled>
                  <Download className="h-3.5 w-3.5" />Export as
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Coming soon</p></TooltipContent>
          </Tooltip>
          {assemblies.length > 0 && provisionalCodes.length === 0 && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Link href="/setup">
                <Settings className="h-3.5 w-3.5" />
                Get Started
              </Link>
            </Button>
          )}
          <Button asChild size="sm" className="gap-1.5 text-xs h-8" style={{ backgroundColor: "var(--figma-cta-p1-bg)", color: "var(--figma-cta-p1-text)" }}>
            <Link href="/analysis">
              <BarChart3 className="h-3.5 w-3.5" />
              Analyze Variance
            </Link>
          </Button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* CONTENT CONTROLS                                              */}
      {/* ============================================================ */}
      <div className="shrink-0 bg-white border-b px-6 py-2 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <div className="flex items-center gap-2">
          {/* Search (placeholder) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md w-48 bg-white" style={{ borderColor: "var(--figma-bg-outline)" }}>
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Search...</span>
          </div>

          {/* Filter */}
          <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-md text-muted-foreground hover:bg-muted/30 transition-colors" style={{ borderColor: "var(--figma-bg-outline)" }}>
            <Filter className="h-3.5 w-3.5" />Filter
          </button>

          {/* Active filter tokens */}
          {showActiveOnly && (
            <button
              onClick={() => setShowActiveOnly(false)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
            >
              Active Codes Only
              <X className="h-3 w-3" />
            </button>
          )}
          {!showActiveOnly && (
            <button
              onClick={() => setShowActiveOnly(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add filter
            </button>
          )}

          {/* View / Snapshot (placeholder) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-md text-muted-foreground opacity-50 cursor-not-allowed" style={{ borderColor: "var(--figma-bg-outline)" }} disabled>
                View: Standard Budget
                <ChevronDown className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Coming soon</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-md text-muted-foreground opacity-50 cursor-not-allowed" style={{ borderColor: "var(--figma-bg-outline)" }} disabled>
                Snapshot: Current
                <ChevronDown className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Coming soon</p></TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Density: Medium</span>
          </div>
          <div className="flex items-center border rounded-md overflow-hidden" style={{ borderColor: "var(--figma-bg-outline)" }}>
            <button className="px-2 py-1.5 text-xs bg-muted/50 text-foreground font-medium"><List className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* DATA TABLE                                                    */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-auto">
        {assemblies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6">
            <Settings className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-semibold mb-1">No budget data yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              Define your scope of work and production targets in Setup to populate the budget view.
            </p>
            <Button asChild variant="outline" className="gap-1.5">
              <Link href="/setup">
                <Settings className="h-4 w-4" />
                Go to Setup
              </Link>
            </Button>
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/10 sticky top-0 z-10">
              <TableHead className="w-[200px] text-xs font-medium">Description</TableHead>
              <TableHead className="text-right text-xs font-medium">Original Budget</TableHead>
              <TableHead className="text-right text-xs font-medium">Budget Changes</TableHead>
              <TableHead className="text-right text-xs font-medium">Approved COs</TableHead>
              <TableHead className="text-right text-xs font-medium">Revised Budget</TableHead>
              <TableHead className="text-right text-xs font-medium">Pending COs</TableHead>
              <TableHead className="text-right text-xs font-medium">Projected Budget</TableHead>
              <TableHead className="text-right text-xs font-medium">Committed Costs</TableHead>
              <TableHead className="text-right text-xs font-medium">Direct Costs</TableHead>
              <TableHead className="text-right text-xs font-medium">JTD Costs</TableHead>
              <TableHead className="text-right text-xs font-medium">Pending Changes</TableHead>
              <TableHead className="text-right text-xs font-medium">Projected Costs</TableHead>
              <TableHead className="text-center text-xs font-medium w-[80px]">% Complete</TableHead>
              <TableHead className="text-center text-xs font-medium w-[60px]">PF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map(({ assembly, isProvisional, agg, pctComplete, pf, stale, originalBudget, approvedChanges, revisedBudget, committedCosts, directCosts, jtdCosts, pendingCostChanges, projectedCost }) => {
              const hasComponents = (assembly.components?.length ?? 0) > 0;
              const isExpanded = expandedWbs.has(assembly.wbs_code);
              const componentAnalyses = hasComponents
                ? calcAllComponents(assembly, agg.totalHours)
                : [];

              return (
              <Fragment key={assembly.wbs_code}>
              <TableRow
                className={cn(
                  "h-12",
                  !isProvisional && "opacity-50",
                  hasComponents && "cursor-pointer hover:bg-muted/10"
                )}
                onClick={hasComponents ? () => toggleExpand(assembly.wbs_code) : undefined}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {hasComponents && (
                      isExpanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    {!hasComponents && isProvisional && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" title="Active this week" />
                    )}
                    {!hasComponents && !isProvisional && (
                      <span className="h-2 w-2 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm leading-tight truncate">{assembly.description}</p>
                        {hasComponents && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                            {assembly.components!.length} components
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{assembly.wbs_code}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(originalBudget)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(approvedChanges)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(0)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(revisedBudget)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(0)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(revisedBudget)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(committedCosts)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{directCosts > 0 ? fmt(directCosts) : <span className="text-muted-foreground">{fmt(0)}</span>}</TableCell>
                <TableCell className="text-right font-mono text-sm">{jtdCosts > 0 ? fmt(jtdCosts) : <span className="text-muted-foreground">{fmt(0)}</span>}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(pendingCostChanges)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">{fmt(projectedCost)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Progress value={pctComplete * 100} className="h-1.5 flex-1" />
                    <span className="text-[11px] font-mono w-8 text-right">
                      {(pctComplete * 100).toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <PFBadge pf={pf} hasData={agg.totalHours > 0} isStale={stale} />
                </TableCell>
              </TableRow>

              {/* Expanded component rows */}
              {isExpanded && componentAnalyses.map((ca) => {
                const compVarFlag = ca.qty_installed > 0 && ca.earned_hours > 0 ? ca.variance_flag : null;
                return (
                  <TableRow key={`${assembly.wbs_code}-${ca.id}`} className="h-10 bg-muted/5">
                    <TableCell>
                      <div className="flex items-center gap-2 pl-6">
                        <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm">{ca.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">{ca.uom}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-[10px] font-mono">{ca.weight_pct.toFixed(1)}% wt</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {ca.qty_installed}/{ca.plan_qty} {ca.uom}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Progress value={ca.progress_pct * 100} className="h-1.5 flex-1" />
                        <span className="text-[10px] font-mono">{(ca.progress_pct * 100).toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {ca.earned_hours > 0 ? `${ca.earned_hours.toFixed(1)} eh` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {ca.bid_rate.toFixed(2)} <span className="text-muted-foreground">{ca.uom}/hr</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {ca.qty_installed > 0 && ca.earned_hours > 0 ? (
                        <>{ca.inferred_rate.toFixed(2)} <span className="text-muted-foreground">{ca.uom}/hr</span></>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {compVarFlag === "ahead" && (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-green-500 bg-green-50 px-2 py-0.5 text-[10px] font-mono font-medium text-green-700">
                          <TrendingUp className="h-3 w-3" />+{Math.abs(ca.variance_pct).toFixed(0)}%
                        </span>
                      )}
                      {compVarFlag === "behind" && (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-red-500 bg-red-50 px-2 py-0.5 text-[10px] font-mono font-medium text-red-700">
                          <TrendingDown className="h-3 w-3" />-{Math.abs(ca.variance_pct).toFixed(0)}%
                        </span>
                      )}
                      {compVarFlag === "on_track" && (
                        <span className="inline-flex items-center gap-0.5 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                          <Minus className="h-3 w-3" />OK
                        </span>
                      )}
                      {compVarFlag === null && <span className="text-[10px] text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Progress value={ca.progress_pct * 100} className="h-1.5 flex-1" />
                        <span className="text-[10px] font-mono w-8 text-right">{(ca.progress_pct * 100).toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {compVarFlag ? (
                        <span className={cn(
                          "text-[10px] font-mono font-semibold",
                          compVarFlag === "behind" && "text-red-600",
                          compVarFlag === "ahead" && "text-green-600"
                        )}>
                          {ca.variance_pct > 0 ? "+" : ""}{ca.variance_pct.toFixed(0)}%
                        </span>
                      ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              </Fragment>
              );
            })}
          </TableBody>
        </Table>
        )}
      </div>

      {/* STICKY FOOTER — Grand Totals */}
      {assemblies.length > 0 && (
        <div className="shrink-0 bg-white border-t-2">
          <Table>
            <TableBody>
              <TableRow className="font-semibold bg-muted/30 h-12">
                <TableCell className="w-[200px] text-sm">Grand Totals</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(totalOriginalBudget)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(0)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(0)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(totalRevisedBudget)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(0)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{fmt(totalRevisedBudget)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(0)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{totalDirectCosts > 0 ? fmt(totalDirectCosts) : <span className="text-muted-foreground">{fmt(0)}</span>}</TableCell>
                <TableCell className="text-right font-mono text-sm">{totalJTD > 0 ? fmt(totalJTD) : <span className="text-muted-foreground">{fmt(0)}</span>}</TableCell>
                <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmt(0)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-bold">{fmt(totalProjectedCosts)}</TableCell>
                <TableCell />
                <TableCell className="text-center">
                  <PFBadge pf={overallPF} hasData={totalActualHours > 0} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
