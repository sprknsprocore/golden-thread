"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Filter, Plus, BarChart3, Settings, Info } from "lucide-react";
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
  } = useProductionStore();

  const [showActiveOnly, setShowActiveOnly] = useState(false);

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
    <div className="space-y-0">
      {/* Procore-style control bar */}
      <div
        className="bg-white border-b px-6 py-2.5 flex items-center justify-between"
        style={{ borderColor: "var(--figma-bg-outline)" }}
      >
        <div className="flex items-center gap-3">
          {/* View dropdown — coming soon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">View</span>
                <button
                  className="flex items-center gap-1 px-2.5 py-1.5 text-sm border rounded-md bg-white opacity-50 cursor-not-allowed"
                  disabled
                >
                  Procore Standard Budget
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent><p>Coming soon</p></TooltipContent>
          </Tooltip>

          {/* Snapshot — coming soon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Snapshot</span>
                <button
                  className="flex items-center gap-1 px-2.5 py-1.5 text-sm border rounded-md bg-white opacity-50 cursor-not-allowed"
                  disabled
                >
                  Current
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent><p>Coming soon</p></TooltipContent>
          </Tooltip>

          {/* Active codes filter — functional */}
          <button
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 text-sm border rounded-md transition-colors",
              showActiveOnly
                ? "bg-primary/10 border-primary/30 text-primary"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            {showActiveOnly ? "Active Codes" : "All Codes"}
          </button>
        </div>

        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link href="/analysis">
            <BarChart3 className="h-3.5 w-3.5" />
            Analyze Variance
          </Link>
        </Button>
      </div>

      {/* Budget Table */}
      <div className="overflow-x-auto">
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
            <TableRow className="bg-muted/20">
              <TableHead className="w-[200px] text-xs">Description</TableHead>
              <TableHead className="text-right text-xs">
                Original Budget
                <br />
                <span className="text-muted-foreground font-normal">Amount</span>
              </TableHead>
              <TableHead className="text-right text-xs">
                Approved Budget
                <br />
                <span className="text-muted-foreground font-normal">Changes</span>
              </TableHead>
              <TableHead className="text-right text-xs">
                Approved COs
              </TableHead>
              <TableHead className="text-right text-xs">
                Revised
                <br />
                <span className="text-muted-foreground font-normal">Budget</span>
              </TableHead>
              <TableHead className="text-right text-xs">
                Pending COs
              </TableHead>
              <TableHead className="text-right text-xs">
                Projected
                <br />
                <span className="text-muted-foreground font-normal">Budget</span>
              </TableHead>
              <TableHead className="text-right text-xs">
                Committed
                <br />
                <span className="text-muted-foreground font-normal">Costs</span>
              </TableHead>
              <TableHead className="text-right text-xs">
                Direct Costs
              </TableHead>
              <TableHead className="text-right text-xs">
                Job to Date
                <br />
                <span className="text-muted-foreground font-normal">Costs</span>
              </TableHead>
              <TableHead className="text-right text-xs">
                Pending Cost
                <br />
                <span className="text-muted-foreground font-normal">Changes</span>
              </TableHead>
              <TableHead className="text-right text-xs">
                Projected
                <br />
                <span className="text-muted-foreground font-normal">Costs</span>
              </TableHead>
              {/* Our enhancements */}
              <TableHead className="text-center text-xs w-[80px]">
                % Complete
              </TableHead>
              <TableHead className="text-center text-xs w-[60px]">
                PF
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map(({ assembly, isProvisional, agg, pctComplete, pf, stale, originalBudget, approvedChanges, revisedBudget, committedCosts, directCosts, jtdCosts, pendingCostChanges, projectedCost }) => (
              <TableRow
                key={assembly.wbs_code}
                className={cn(
                  "h-12",
                  !isProvisional && "opacity-50"
                )}
              >
                {/* Description */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isProvisional && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" title="Active this week" />
                    )}
                    <div>
                      <p className="font-medium text-sm leading-tight">{assembly.description}</p>
                      <p className="text-xs text-muted-foreground font-mono">{assembly.wbs_code}</p>
                    </div>
                  </div>
                </TableCell>

                {/* Original Budget Amount */}
                <TableCell className="text-right font-mono text-sm">
                  {fmt(originalBudget)}
                </TableCell>

                {/* Approved Budget Changes */}
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {fmt(approvedChanges)}
                </TableCell>

                {/* Approved COs */}
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {fmt(0)}
                </TableCell>

                {/* Revised Budget */}
                <TableCell className="text-right font-mono text-sm">
                  {fmt(revisedBudget)}
                </TableCell>

                {/* Pending COs */}
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {fmt(0)}
                </TableCell>

                {/* Projected Budget */}
                <TableCell className="text-right font-mono text-sm">
                  {fmt(revisedBudget)}
                </TableCell>

                {/* Committed Costs */}
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {fmt(committedCosts)}
                </TableCell>

                {/* Direct Costs */}
                <TableCell className="text-right font-mono text-sm">
                  {directCosts > 0 ? fmt(directCosts) : <span className="text-muted-foreground">{fmt(0)}</span>}
                </TableCell>

                {/* JTD Costs */}
                <TableCell className="text-right font-mono text-sm">
                  {jtdCosts > 0 ? fmt(jtdCosts) : <span className="text-muted-foreground">{fmt(0)}</span>}
                </TableCell>

                {/* Pending Cost Changes */}
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {fmt(pendingCostChanges)}
                </TableCell>

                {/* Projected Costs */}
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {fmt(projectedCost)}
                </TableCell>

                {/* % Complete - our enhancement */}
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Progress value={pctComplete * 100} className="h-1.5 flex-1" />
                    <span className="text-[11px] font-mono w-8 text-right">
                      {(pctComplete * 100).toFixed(0)}%
                    </span>
                  </div>
                </TableCell>

                {/* PF - our enhancement */}
                <TableCell className="text-center">
                  <PFBadge pf={pf} hasData={agg.totalHours > 0} isStale={stale} />
                </TableCell>
              </TableRow>
            ))}

            {/* Grand Totals */}
            <TableRow className="border-t-2 font-semibold bg-muted/30 h-12">
              <TableCell className="text-sm">Grand Totals</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {fmt(totalOriginalBudget)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                {fmt(0)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                {fmt(0)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {fmt(totalRevisedBudget)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                {fmt(0)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {fmt(totalRevisedBudget)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                {fmt(0)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {totalDirectCosts > 0 ? fmt(totalDirectCosts) : <span className="text-muted-foreground">{fmt(0)}</span>}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {totalJTD > 0 ? fmt(totalJTD) : <span className="text-muted-foreground">{fmt(0)}</span>}
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                {fmt(0)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-bold">
                {fmt(totalProjectedCosts)}
              </TableCell>
              <TableCell />
              <TableCell className="text-center">
                <PFBadge pf={overallPF} hasData={totalActualHours > 0} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
