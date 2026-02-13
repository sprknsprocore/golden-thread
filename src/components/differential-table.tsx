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
      <Badge variant="outline" className="text-xs font-mono gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        0{suffix}
      </Badge>
    );
  }
  const isNegative = value < 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-mono gap-1",
        isNegative
          ? "border-green-500 text-green-700 bg-green-50"
          : "border-red-500 text-red-700 bg-red-50"
      )}
    >
      {isNegative ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {value > 0 ? "+" : ""}{value.toFixed(1)}{suffix}
    </Badge>
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
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Description</TableHead>
                  {/* Quantity */}
                  <TableHead className="text-center bg-muted/20" colSpan={3}>
                    Quantity
                  </TableHead>
                  {/* Hours */}
                  <TableHead className="text-center bg-blue-50/30" colSpan={4}>
                    Hours
                  </TableHead>
                  {/* Cost */}
                  <TableHead className="text-center bg-amber-50/30" colSpan={3}>
                    Cost
                  </TableHead>
                  {/* Signal */}
                  <TableHead className="text-center" colSpan={2}>
                    Signal
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead />
                  {/* Quantity sub-headers */}
                  <TableHead className="text-right bg-muted/20 text-xs">Budget</TableHead>
                  <TableHead className="text-right bg-muted/20 text-xs">Actual</TableHead>
                  <TableHead className="text-center bg-muted/20 text-xs">% Complete</TableHead>
                  {/* Hours sub-headers */}
                  <TableHead className="text-right bg-blue-50/30 text-xs">Budget</TableHead>
                  <TableHead className="text-right bg-blue-50/30 text-xs">Earned</TableHead>
                  <TableHead className="text-right bg-blue-50/30 text-xs">Actual</TableHead>
                  <TableHead className="text-center bg-blue-50/30 text-xs">Diff</TableHead>
                  {/* Cost sub-headers */}
                  <TableHead className="text-right bg-amber-50/30 text-xs">Budget</TableHead>
                  <TableHead className="text-right bg-amber-50/30 text-xs">Actual</TableHead>
                  <TableHead className="text-center bg-amber-50/30 text-xs">Variance</TableHead>
                  {/* Signal sub-headers */}
                  <TableHead className="text-center text-xs">PF</TableHead>
                  <TableHead className="text-center text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysisData.map((row) => (
                  <TableRow key={row.wbs_code}>
                    {/* Description */}
                    <TableCell>
                      <p className="font-medium text-sm">{row.description}</p>
                      <p className="text-xs text-muted-foreground">{row.wbs_code}</p>
                    </TableCell>

                    {/* Quantity: Budget */}
                    <TableCell className="text-right font-mono text-sm bg-muted/10">
                      {row.budgeted_qty.toLocaleString()} {row.uom}
                    </TableCell>
                    {/* Quantity: Actual */}
                    <TableCell className="text-right font-mono text-sm bg-muted/10">
                      {row.actual_qty > 0 ? `${row.actual_qty.toLocaleString()} ${row.uom}` : "—"}
                    </TableCell>
                    {/* Quantity: % Complete */}
                    <TableCell className="bg-muted/10">
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <Progress value={row.qty_pct_complete} className="h-2 flex-1" />
                        <span className="text-xs font-mono w-10 text-right">
                          {row.qty_pct_complete.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>

                    {/* Hours: Budget */}
                    <TableCell className="text-right font-mono text-sm bg-blue-50/10">
                      {row.budgeted_hours.toFixed(0)}
                    </TableCell>
                    {/* Hours: Earned */}
                    <TableCell className="text-right font-mono text-sm bg-blue-50/10">
                      {row.earned_hours > 0 ? row.earned_hours.toFixed(1) : "—"}
                    </TableCell>
                    {/* Hours: Actual */}
                    <TableCell className="text-right font-mono text-sm bg-blue-50/10">
                      {row.actual_hours > 0 ? row.actual_hours.toFixed(1) : "—"}
                    </TableCell>
                    {/* Hours: Differential */}
                    <TableCell className="text-center bg-blue-50/10">
                      {row.actual_hours > 0 ? (
                        <VarianceBadge value={row.hour_differential} suffix="h" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Cost: Budget */}
                    <TableCell className="text-right font-mono text-sm bg-amber-50/10">
                      {formatCurrency(row.budgeted_cost)}
                    </TableCell>
                    {/* Cost: Actual */}
                    <TableCell className="text-right font-mono text-sm bg-amber-50/10">
                      {row.actual_cost > 0 ? formatCurrency(row.actual_cost) : "—"}
                    </TableCell>
                    {/* Cost: Variance */}
                    <TableCell className="text-center bg-amber-50/10">
                      {row.actual_cost > 0 ? (
                        <VarianceBadge value={row.cost_variance_pct} suffix="%" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* PF */}
                    <TableCell className="text-center">
                      <PFBadge pf={row.performance_factor} hasData={row.actual_hours > 0} />
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <StatusIcon status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals row */}
                {analysisData.length > 0 && (
                  <TableRow className="border-t-2 font-semibold bg-muted/5">
                    <TableCell className="text-sm">Project Totals</TableCell>
                    {/* Qty cols — no meaningful total */}
                    <TableCell className="bg-muted/10" />
                    <TableCell className="bg-muted/10" />
                    <TableCell className="bg-muted/10" />
                    {/* Hours */}
                    <TableCell className="text-right font-mono text-sm bg-blue-50/10">
                      {totals.budgeted_hours.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm bg-blue-50/10">
                      {totals.earned_hours > 0 ? totals.earned_hours.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm bg-blue-50/10">
                      {totals.actual_hours > 0 ? totals.actual_hours.toFixed(1) : "—"}
                    </TableCell>
                    <TableCell className="text-center bg-blue-50/10">
                      {hasData ? (
                        <VarianceBadge value={overallHourVariance} suffix="h" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {/* Cost */}
                    <TableCell className="text-right font-mono text-sm bg-amber-50/10">
                      {formatCurrency(totals.budgeted_cost)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm bg-amber-50/10">
                      {totals.actual_cost > 0 ? formatCurrency(totals.actual_cost) : "—"}
                    </TableCell>
                    <TableCell className="text-center bg-amber-50/10">
                      {hasData ? (
                        <VarianceBadge
                          value={totals.budgeted_cost !== 0 ? (overallCostVariance / totals.budgeted_cost) * 100 : 0}
                          suffix="%"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {/* PF */}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
