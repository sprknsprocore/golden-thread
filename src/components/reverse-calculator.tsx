"use client";

import { useState } from "react";
import { Calculator, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProductionStore } from "@/store/use-production-store";
import { aggregateEvents, calcReverseRate } from "@/lib/calculations";

export function ReverseCalculator() {
  const { assemblies, provisionalCodes, productionEvents } =
    useProductionStore();

  const provisionalAssemblies = provisionalCodes
    .map((code) => assemblies.find((a) => a.wbs_code === code))
    .filter(Boolean);

  const [selectedCode, setSelectedCode] = useState<string>(
    provisionalCodes[0] ?? ""
  );
  const [ecacOverride, setEcacOverride] = useState<string>("");

  const assembly = assemblies.find((a) => a.wbs_code === selectedCode);
  const agg = assembly
    ? aggregateEvents(productionEvents, assembly.wbs_code)
    : null;

  const actualCostToDate =
    assembly && agg
      ? agg.totalQty * assembly.blended_unit_cost
      : 0;

  const originalBudget = assembly
    ? assembly.budgeted_qty * assembly.blended_unit_cost
    : 0;

  const ecacValue = parseFloat(ecacOverride);
  const result =
    assembly && agg && !isNaN(ecacValue)
      ? calcReverseRate(
          assembly.budgeted_qty,
          agg.totalQty,
          assembly.budgeted_hours,
          agg.totalHours,
          ecacValue,
          assembly.blended_unit_cost,
          actualCostToDate
        )
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Reverse Calculation Engine
        </CardTitle>
        <CardDescription>
          Override the ECAC to back-calculate the required production rate
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">Select WBS Code</Label>
          <Select value={selectedCode} onValueChange={setSelectedCode}>
            <SelectTrigger>
              <SelectValue placeholder="Select a code..." />
            </SelectTrigger>
            <SelectContent>
              {provisionalAssemblies.map((a) =>
                a ? (
                  <SelectItem key={a.wbs_code} value={a.wbs_code}>
                    {a.description}
                  </SelectItem>
                ) : null
              )}
            </SelectContent>
          </Select>
        </div>

        {assembly && agg && (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Original Budget</p>
                <p className="font-mono font-semibold">
                  ${originalBudget.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Actual Cost to Date
                </p>
                <p className="font-mono font-semibold">
                  ${actualCostToDate.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Qty Installed</p>
                <p className="font-mono">
                  {agg.totalQty.toLocaleString()} / {assembly.budgeted_qty.toLocaleString()}{" "}
                  {assembly.uom}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hours Used</p>
                <p className="font-mono">
                  {agg.totalHours.toFixed(1)} / {assembly.budgeted_hours} hrs
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">ECAC Override ($)</Label>
              <Input
                type="number"
                placeholder={originalBudget.toFixed(2)}
                value={ecacOverride}
                onChange={(e) => setEcacOverride(e.target.value)}
                className="font-mono"
              />
            </div>

            {result && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">
                    Required Production Rate
                  </span>
                </div>
                <p className="text-2xl font-bold font-mono">
                  {result.requiredRate.toFixed(3)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {assembly.uom}/hr
                  </span>
                </p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    Remaining: {result.remainingQty.toLocaleString()}{" "}
                    {assembly.uom}
                  </span>
                  <span>
                    Budget Hrs Left: {result.remainingHours.toFixed(1)}
                  </span>
                </div>
                {assembly.budgeted_qty > 0 && (
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className="text-xs font-mono"
                    >
                      Original rate:{" "}
                      {(
                        assembly.budgeted_qty / assembly.budgeted_hours
                      ).toFixed(3)}{" "}
                      {assembly.uom}/hr
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
