"use client";

import { useState } from "react";
import {
  X,
  Users,
  Plus,
  ArrowRight,
  PackagePlus,
  ListPlus,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddCodesModal } from "@/components/add-codes-modal";
import { CodeCreatorModal } from "@/components/code-creator-modal";
import { useProductionStore } from "@/store/use-production-store";

export default function SetupPage() {
  const { assemblies, provisionalCodes, removeProvisionalCode } =
    useProductionStore();
  const [addCodesOpen, setAddCodesOpen] = useState(false);
  const [createCodeOpen, setCreateCodeOpen] = useState(false);

  const provisionalAssemblies = provisionalCodes
    .map((code) => assemblies.find((a) => a.wbs_code === code))
    .filter(Boolean);

  // Totals
  const totalBudgetQty = provisionalAssemblies.reduce(
    (s, a) => s + (a?.budgeted_qty ?? 0),
    0
  );
  const totalBudgetHrs = provisionalAssemblies.reduce(
    (s, a) => s + (a?.budgeted_hours ?? 0),
    0
  );
  const totalBudgetAmt = provisionalAssemblies.reduce(
    (s, a) => s + (a ? a.budgeted_qty * a.blended_unit_cost : 0),
    0
  );

  return (
    <div className="space-y-0">
      {/* Procore-style control bar */}
      <div
        className="bg-white border-b px-6 py-2.5 flex items-center justify-between"
        style={{ borderColor: "var(--figma-bg-outline)" }}
      >
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Select assemblies for this week&apos;s reporting period.
          </p>
          {provisionalCodes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {provisionalCodes.length} code{provisionalCodes.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setCreateCodeOpen(true)}
          >
            <PackagePlus className="h-3.5 w-3.5" />
            Create New Code
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setAddCodesOpen(true)}
          >
            <ListPlus className="h-3.5 w-3.5" />
            Add Codes
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="overflow-x-auto">
        {provisionalAssemblies.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 px-6">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Inbox className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              No provisional codes selected
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              Add assemblies from the estimate to build your weekly reporting
              scope. These codes persist even with zero hours logged.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setCreateCodeOpen(true)}
              >
                <PackagePlus className="h-4 w-4" />
                Create New Code
              </Button>
              <Button
                className="gap-1.5 bg-figma-orange hover:bg-figma-orange-hover text-white"
                onClick={() => setAddCodesOpen(true)}
              >
                <ListPlus className="h-4 w-4" />
                Add from Estimate
              </Button>
            </div>
          </div>
        ) : (
          /* Provisional codes table */
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="w-10 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-muted-foreground/30"
                      disabled
                    />
                  </TableHead>
                  <TableHead className="w-[280px] text-xs">
                    Description
                  </TableHead>
                  <TableHead className="text-xs">WBS Code</TableHead>
                  <TableHead className="text-right text-xs">
                    Budget Qty
                  </TableHead>
                  <TableHead className="text-center text-xs">UOM</TableHead>
                  <TableHead className="text-right text-xs">
                    Budget Hrs
                  </TableHead>
                  <TableHead className="text-center text-xs">Crew</TableHead>
                  <TableHead className="text-right text-xs">
                    Budget Amount
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {provisionalAssemblies.map((assembly) => {
                  if (!assembly) return null;
                  const totalBudget =
                    assembly.budgeted_qty * assembly.blended_unit_cost;
                  const crewSize =
                    assembly.crew_template?.reduce(
                      (s, m) => s + m.count,
                      0
                    ) ?? 0;

                  return (
                    <TableRow key={assembly.wbs_code} className="h-12">
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          className="rounded border-muted-foreground/30"
                          disabled
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">
                          {assembly.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground font-mono">
                          {assembly.wbs_code}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {assembly.budgeted_qty.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {assembly.uom}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {assembly.budgeted_hours}
                      </TableCell>
                      <TableCell className="text-center">
                        {crewSize > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="text-xs gap-1 cursor-help"
                              >
                                <Users className="h-3 w-3" />
                                {crewSize}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-0.5">
                                {assembly.crew_template.map((m) => (
                                  <p key={m.role} className="text-xs">
                                    {m.count}x {m.role}
                                  </p>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {totalBudget > 0
                          ? `$${totalBudget.toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() =>
                            removeProvisionalCode(assembly.wbs_code)
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Totals row */}
                <TableRow className="border-t-2 font-semibold bg-muted/30 h-12">
                  <TableCell />
                  <TableCell className="text-sm">
                    Totals ({provisionalCodes.length} code
                    {provisionalCodes.length !== 1 ? "s" : ""})
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono text-sm">
                    {totalBudgetQty.toLocaleString()}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono text-sm">
                    {totalBudgetHrs.toLocaleString()}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono text-sm font-bold">
                    ${totalBudgetAmt.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>

            {/* Footer action bar */}
            <div
              className="bg-white border-t px-6 py-4 flex items-center justify-between"
              style={{ borderColor: "var(--figma-bg-outline)" }}
            >
              <p className="text-sm text-muted-foreground">
                {provisionalCodes.length} provisional code
                {provisionalCodes.length !== 1 ? "s" : ""} ready for field
                reporting.
              </p>
              <Link href="/capture">
                <Button className="gap-1.5 bg-figma-orange hover:bg-figma-orange-hover text-white">
                  Continue to Capture
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <AddCodesModal open={addCodesOpen} onOpenChange={setAddCodesOpen} />
      <CodeCreatorModal open={createCodeOpen} onOpenChange={setCreateCodeOpen} />
    </div>
  );
}
