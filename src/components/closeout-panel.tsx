"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Database,
  GitCompareArrows,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useProductionStore,
  type EstimatingRecord,
} from "@/store/use-production-store";
import { aggregateEvents, calcFinalProductionRate } from "@/lib/calculations";
import { cn } from "@/lib/utils";

export function CloseoutPanel() {
  const {
    assemblies,
    provisionalCodes,
    productionEvents,
    pmOverrides,
    estimatingDatabase,
    pushToEstimatingDb,
  } = useProductionStore();

  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const provisionalAssemblies = provisionalCodes
    .map((code) => assemblies.find((a) => a.wbs_code === code))
    .filter(Boolean);

  // Calculate final rates for each assembly
  const rateData = provisionalAssemblies
    .map((assembly) => {
      if (!assembly) return null;

      const agg = aggregateEvents(productionEvents, assembly.wbs_code);
      const override = pmOverrides.find(
        (o) => o.wbs_code === assembly.wbs_code
      );

      const finalQty = override?.validated_qty ?? agg.totalQty;
      const finalHours = override?.validated_hours ?? agg.totalHours;
      const finalRate = calcFinalProductionRate(finalHours, finalQty);
      const budgetedRate =
        assembly.budgeted_qty > 0
          ? assembly.budgeted_hours / assembly.budgeted_qty
          : 0;
      const variance =
        budgetedRate > 0
          ? ((finalRate - budgetedRate) / budgetedRate) * 100
          : 0;

      // Derive pushed state from store
      const isPushed = estimatingDatabase.some(
        (r) => r.wbs_code === assembly.wbs_code
      );

      return {
        wbs_code: assembly.wbs_code,
        description: assembly.description,
        uom: assembly.uom,
        budgetedRate,
        finalRate,
        finalQty,
        finalHours,
        variance,
        isPushed,
      };
    })
    .filter(Boolean);

  const pushableItems = rateData.filter((d) => d && d.finalHours > 0 && !d.isPushed);
  const selectedPushable = pushableItems.filter((d) => d && selectedCodes.has(d.wbs_code));
  const allPushed = rateData.every((d) => d?.isPushed || d?.finalHours === 0);

  const toggleCode = (wbsCode: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(wbsCode)) next.delete(wbsCode);
      else next.add(wbsCode);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCodes.size === pushableItems.length) {
      setSelectedCodes(new Set());
    } else {
      setSelectedCodes(new Set(pushableItems.map((d) => d!.wbs_code)));
    }
  };

  const handlePush = () => {
    const records: EstimatingRecord[] = selectedPushable
      .map((d) => ({
        wbs_code: d!.wbs_code,
        description: d!.description,
        final_rate: d!.finalRate,
        uom: d!.uom,
        pushed_at: new Date().toISOString(),
      }));

    pushToEstimatingDb(records);
    setSelectedCodes(new Set());
    toast.success(
      `${records.length} production rate${records.length !== 1 ? "s" : ""} pushed to estimating database`
    );
  };

  /* ---------- Empty states ---------- */

  if (rateData.length === 0) {
    return (
      <div className="text-center py-16">
        {productionEvents.length === 0 ? (
          <>
            <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No production data available yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Complete field capture and True-Up before generating final rates.
            </p>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/capture">
                <ClipboardList className="h-3.5 w-3.5" />
                Go to Capture
              </Link>
            </Button>
          </>
        ) : (
          <>
            <GitCompareArrows className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Field data exists but needs reconciliation.
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Complete the True-Up step to validate quantities before pushing
              rates.
            </p>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/reconciliation">
                <GitCompareArrows className="h-3.5 w-3.5" />
                Go to True-Up
              </Link>
            </Button>
          </>
        )}
      </div>
    );
  }

  /* ---------- Main render ---------- */

  return (
    <div className="space-y-0">
      {/* Full-width table — no card wrapper */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="w-10 text-center">
                <input
                  type="checkbox"
                  className="rounded border-muted-foreground/30"
                  checked={pushableItems.length > 0 && selectedCodes.size === pushableItems.length}
                  onChange={toggleAll}
                  disabled={pushableItems.length === 0}
                />
              </TableHead>
              <TableHead className="w-[250px] text-xs">Description</TableHead>
              <TableHead className="text-right text-xs">Final Qty</TableHead>
              <TableHead className="text-right text-xs">Final Hrs</TableHead>
              <TableHead className="text-right text-xs">
                Budgeted Rate (MH/Unit)
              </TableHead>
              <TableHead className="text-right text-xs">
                Actual Rate (MH/Unit)
              </TableHead>
              <TableHead className="text-center text-xs">Variance</TableHead>
              <TableHead className="text-center text-xs w-20">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rateData.map((d) => {
              if (!d) return null;
              const isImproved = d.finalRate <= d.budgetedRate;
              const canSelect = d.finalHours > 0 && !d.isPushed;
              const isSelected = selectedCodes.has(d.wbs_code);

              return (
                <TableRow
                  key={d.wbs_code}
                  className={cn("h-12", d.isPushed && "bg-green-50/40")}
                >
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      className="rounded border-muted-foreground/30"
                      checked={isSelected}
                      onChange={() => toggleCode(d.wbs_code)}
                      disabled={!canSelect}
                    />
                  </TableCell>
                  <TableCell>
                    <div
                      className={cn(d.isPushed && "border-l-2 border-green-500 pl-2")}
                    >
                      <p className="font-medium text-sm">{d.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.wbs_code}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {d.finalQty > 0
                      ? `${d.finalQty.toLocaleString()} ${d.uom}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {d.finalHours > 0 ? d.finalHours.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {d.budgetedRate.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {d.finalHours > 0 ? d.finalRate.toFixed(4) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {d.finalHours > 0 ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono gap-1",
                          isImproved
                            ? "text-green-700 border-green-500 bg-green-50"
                            : "text-red-700 border-red-500 bg-red-50"
                        )}
                      >
                        {isImproved ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        {d.variance > 0 ? "+" : ""}
                        {d.variance.toFixed(1)}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No data
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {d.isPushed ? (
                      <Badge variant="outline" className="text-[10px] gap-1 border-green-500 text-green-700 bg-green-50">
                        <CheckCircle2 className="h-3 w-3" />
                        Pushed
                      </Badge>
                    ) : d.finalHours > 0 ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Ready
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Footer action bar */}
      <div
        className="bg-white border rounded-b-lg border-t-0 px-6 py-4 flex items-center justify-between -mt-px"
        style={{ borderColor: "var(--figma-bg-outline)" }}
      >
        <div className="flex items-center gap-3">
          <Database className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {allPushed
              ? `All rates transferred to estimating database.`
              : selectedPushable.length > 0
              ? `${selectedPushable.length} code${selectedPushable.length !== 1 ? "s" : ""} selected to push.`
              : `${pushableItems.length} code${pushableItems.length !== 1 ? "s" : ""} with production data ready to push.`}
          </p>
        </div>
        {allPushed ? (
          <Button disabled className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            All Pushed
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={selectedPushable.length === 0}
                className={cn(
                  "gap-1.5",
                  selectedPushable.length > 0 && "bg-figma-orange hover:bg-figma-orange-hover text-white"
                )}
              >
                Push {selectedPushable.length > 0 ? `${selectedPushable.length} ` : ""}Rate{selectedPushable.length !== 1 ? "s" : ""}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Push rates to estimating?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will transfer {selectedPushable.length} production rate{selectedPushable.length !== 1 ? "s" : ""} to the
                  estimating database. This action informs future bid accuracy.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-figma-orange hover:bg-figma-orange-hover text-white"
                  onClick={handlePush}
                >
                  Push Rates
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Estimating Database results (shown when any records exist) */}
      {estimatingDatabase.length > 0 && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-4 w-4 text-green-800" />
            <h3 className="text-sm font-semibold text-green-800">
              Estimating Database (Mock)
            </h3>
            <span className="text-xs text-green-700">
              These rates are now available for future bids
            </span>
          </div>
          <div className="space-y-2">
            {estimatingDatabase.map((record) => (
              <div
                key={record.wbs_code}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-green-800">{record.description}</span>
                <Badge
                  variant="outline"
                  className="font-mono border-green-500 text-green-700"
                >
                  {record.final_rate.toFixed(4)} MH/{record.uom}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
