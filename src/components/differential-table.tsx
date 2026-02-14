"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProductionStore } from "@/store/use-production-store";
import { calcAssemblyAnalysis, type AssemblyAnalysis } from "@/lib/calculations";
import { cn } from "@/lib/utils";

function formatCurrency(value: number): string {
  return `$${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function VarianceBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground leading-none">
        <Minus className="h-3 w-3" />0{suffix}
      </span>
    );
  }
  const isNegative = value < 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-mono font-medium leading-none",
      isNegative
        ? "border-green-500 text-green-700 bg-green-50"
        : "border-red-500 text-red-700 bg-red-50"
    )}>
      {isNegative ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {value > 0 ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

function StatusIcon({ status }: { status: AssemblyAnalysis["status"] }) {
  switch (status) {
    case "on_track":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "at_risk":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "over":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
  }
}

export function DifferentialTable() {
  const {
    assemblies,
    provisionalCodes,
    productionEvents,
    pmOverrides,
    claimingSchemas,
  } = useProductionStore();

  const analysisData = useMemo(() => {
    return provisionalCodes
      .map((code) => {
        const assembly = assemblies.find((a) => a.wbs_code === code);
        if (!assembly) return null;

        const override = pmOverrides.find((o) => o.wbs_code === code);
        const schema = assembly.claiming_schema_id
          ? claimingSchemas[assembly.claiming_schema_id]
          : null;

        return calcAssemblyAnalysis(
          assembly,
          productionEvents,
          override ? { validated_qty: override.validated_qty, validated_hours: override.validated_hours } : null,
          schema
        );
      })
      .filter(Boolean) as AssemblyAnalysis[];
  }, [assemblies, provisionalCodes, productionEvents, pmOverrides, claimingSchemas]);

  // Summary totals
  const totals = useMemo(() => {
    return analysisData.reduce(
      (acc, row) => ({
        budgeted_hours: acc.budgeted_hours + row.budgeted_hours,
        earned_hours: acc.earned_hours + row.earned_hours,
        actual_hours: acc.actual_hours + row.actual_hours,
        budgeted_cost: acc.budgeted_cost + row.budgeted_cost,
        actual_cost: acc.actual_cost + row.actual_cost,
      }),
      { budgeted_hours: 0, earned_hours: 0, actual_hours: 0, budgeted_cost: 0, actual_cost: 0 }
    );
  }, [analysisData]);

  const overallPF =
    totals.actual_hours > 0
      ? totals.earned_hours / totals.actual_hours
      : 0;
  const overallCostVariance = totals.actual_cost - totals.budgeted_cost;
  const overallHourVariance = totals.actual_hours - totals.earned_hours;

  const hasData = analysisData.some((r) => r.actual_hours > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Budget</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {formatCurrency(totals.budgeted_cost)}
            </p>
            {hasData && totals.actual_cost > 0 && (
              <p className={cn(
                "text-xs font-mono mt-1",
                overallCostVariance <= 0 ? "text-green-600" : "text-red-600"
              )}>
                {overallCostVariance <= 0 ? "Under" : "Over"} by{" "}
                {formatCurrency(overallCostVariance)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Hours: Budgeted vs Actual</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {totals.actual_hours.toFixed(1)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {totals.budgeted_hours.toFixed(0)}
              </span>
            </p>
            {hasData && (
              <p className={cn(
                "text-xs font-mono mt-1",
                overallHourVariance <= 0 ? "text-green-600" : "text-red-600"
              )}>
                Earned: {totals.earned_hours.toFixed(1)}h | Diff: {overallHourVariance > 0 ? "+" : ""}
                {overallHourVariance.toFixed(1)}h
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Overall Performance Factor</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold font-mono",
              !hasData
                ? "text-muted-foreground"
                : overallPF >= 1
                ? "text-green-600"
                : "text-red-600"
            )}>
              {hasData ? overallPF.toFixed(2) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasData
                ? overallPF >= 1
                  ? "Earning more than spending"
                  : "Spending more than earning"
                : "No production data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Cost Variance</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold font-mono",
              !hasData
                ? "text-muted-foreground"
                : overallCostVariance <= 0
                ? "text-green-600"
                : "text-red-600"
            )}>
              {hasData
                ? `${overallCostVariance > 0 ? "+" : "-"}${formatCurrency(overallCostVariance)}`
                : "—"}
            </p>
            {hasData && totals.budgeted_cost > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {((overallCostVariance / totals.budgeted_cost) * 100).toFixed(1)}% of total budget
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Code Breakdown</CardTitle>
          <CardDescription>
            Budget, hours, and productivity aligned per WBS code. Green = under/on target. Red = over.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/10 sticky top-0 z-10">
                <TableHead className="w-[180px] text-xs font-medium">Description</TableHead>
                <TableHead className="text-right text-xs font-medium">Qty Budget</TableHead>
                <TableHead className="text-right text-xs font-medium">Qty Actual</TableHead>
                <TableHead className="text-center text-xs font-medium">% Complete</TableHead>
                <TableHead className="text-right text-xs font-medium">Hrs Budget</TableHead>
                <TableHead className="text-right text-xs font-medium">Hrs Earned</TableHead>
                <TableHead className="text-right text-xs font-medium">Hrs Actual</TableHead>
                <TableHead className="text-center text-xs font-medium">Hrs Diff</TableHead>
                <TableHead className="text-right text-xs font-medium">Cost Budget</TableHead>
                <TableHead className="text-right text-xs font-medium">Cost Actual</TableHead>
                <TableHead className="text-center text-xs font-medium">Cost Var</TableHead>
                <TableHead className="text-center text-xs font-medium w-[60px]">PF</TableHead>
                <TableHead className="text-center text-xs font-medium w-[50px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysisData.map((row) => (
                <TableRow key={row.wbs_code} className="h-12">
                  <TableCell>
                    <p className="font-medium text-sm leading-tight">{row.description}</p>
                    <p className="text-xs text-muted-foreground font-mono">{row.wbs_code}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {row.budgeted_qty.toLocaleString()} {row.uom}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {row.actual_qty > 0 ? `${row.actual_qty.toLocaleString()} ${row.uom}` : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-[80px]">
                      <Progress value={row.qty_pct_complete} className="h-1.5 flex-1" />
                      <span className="text-[11px] font-mono w-8 text-right">{row.qty_pct_complete.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.budgeted_hours.toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.earned_hours > 0 ? row.earned_hours.toFixed(1) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.actual_hours > 0 ? row.actual_hours.toFixed(1) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-center">
                    {row.actual_hours > 0 ? <VarianceBadge value={row.hour_differential} suffix="h" /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(row.budgeted_cost)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.actual_cost > 0 ? formatCurrency(row.actual_cost) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-center">
                    {row.actual_cost > 0 ? <VarianceBadge value={row.cost_variance_pct} suffix="%" /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <PFBadge pf={row.performance_factor} hasData={row.actual_hours > 0} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIcon status={row.status} />
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals row */}
              {analysisData.length > 0 && (
                <TableRow className="border-t-2 font-semibold bg-muted/30 h-12">
                  <TableCell className="text-sm">Project Totals</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-mono text-sm">{totals.budgeted_hours.toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{totals.earned_hours > 0 ? totals.earned_hours.toFixed(1) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{totals.actual_hours > 0 ? totals.actual_hours.toFixed(1) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-center">
                    {hasData ? <VarianceBadge value={overallHourVariance} suffix="h" /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatCurrency(totals.budgeted_cost)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{totals.actual_cost > 0 ? formatCurrency(totals.actual_cost) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-center">
                    {hasData ? <VarianceBadge value={totals.budgeted_cost !== 0 ? (overallCostVariance / totals.budgeted_cost) * 100 : 0} suffix="%" /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <PFBadge pf={overallPF} hasData={hasData} />
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}

              {analysisData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-12">
                    <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No production data to analyze yet.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Complete Setup and Capture to populate the analysis view.
                    </p>
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <Link href="/capture">
                        <ClipboardList className="h-3.5 w-3.5" />
                        Go to Capture
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
