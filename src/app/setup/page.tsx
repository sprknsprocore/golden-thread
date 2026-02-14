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
  Search,
  Filter,
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddCodesModal } from "@/components/add-codes-modal";
import { CodeCreatorModal } from "@/components/code-creator-modal";
import { useProductionStore } from "@/store/use-production-store";

export default function SetupPage() {
  const { assemblies, provisionalCodes, removeProvisionalCode, projectMetadata } =
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
    <TooltipProvider>
    <div className="flex flex-col h-full">

      {/* PAGE HEADER */}
      <div className="shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            Home &middot; {projectMetadata.name} &middot; Financial Management
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Setup</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setCreateCodeOpen(true)}>
            <PackagePlus className="h-3.5 w-3.5" />Create New Code
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-8" style={{ backgroundColor: "var(--figma-cta-p1-bg)", color: "var(--figma-cta-p1-text)" }} onClick={() => setAddCodesOpen(true)}>
            <ListPlus className="h-3.5 w-3.5" />Add Codes
          </Button>
        </div>
      </div>

      {/* CONTENT CONTROLS */}
      <div className="shrink-0 bg-white border-b px-6 py-2 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md w-48 bg-white" style={{ borderColor: "var(--figma-bg-outline)" }}>
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Search...</span>
          </div>
          <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-md text-muted-foreground hover:bg-muted/30 transition-colors" style={{ borderColor: "var(--figma-bg-outline)" }}>
            <Filter className="h-3.5 w-3.5" />Filter
          </button>
          {provisionalCodes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {provisionalCodes.length} code{provisionalCodes.length !== 1 ? "s" : ""} selected
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Select assemblies for this week&apos;s reporting period.
        </p>
      </div>

      {/* DATA TABLE */}
      <div className="flex-1 overflow-auto">
        {provisionalAssemblies.length === 0 ? (
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
              <Button variant="outline" className="gap-1.5" onClick={() => setCreateCodeOpen(true)}>
                <PackagePlus className="h-4 w-4" />Create New Code
              </Button>
              <Button className="gap-1.5" style={{ backgroundColor: "var(--figma-cta-p1-bg)", color: "var(--figma-cta-p1-text)" }} onClick={() => setAddCodesOpen(true)}>
                <ListPlus className="h-4 w-4" />Add from Estimate
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/10 sticky top-0 z-10">
                <TableHead className="w-10 text-center">
                  <input type="checkbox" className="rounded border-muted-foreground/30" disabled />
                </TableHead>
                <TableHead className="w-[280px] text-xs font-medium">Description</TableHead>
                <TableHead className="text-xs font-medium">WBS Code</TableHead>
                <TableHead className="text-right text-xs font-medium">Budget Qty</TableHead>
                <TableHead className="text-center text-xs font-medium">UOM</TableHead>
                <TableHead className="text-right text-xs font-medium">Budget Hrs</TableHead>
                <TableHead className="text-center text-xs font-medium">Crew</TableHead>
                <TableHead className="text-right text-xs font-medium">Budget Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {provisionalAssemblies.map((assembly) => {
                if (!assembly) return null;
                const totalBudget = assembly.budgeted_qty * assembly.blended_unit_cost;
                const crewSize = assembly.crew_template?.reduce((s, m) => s + m.count, 0) ?? 0;

                return (
                  <TableRow key={assembly.wbs_code} className="h-12">
                    <TableCell className="text-center">
                      <input type="checkbox" className="rounded border-muted-foreground/30" disabled />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{assembly.description}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono">{assembly.wbs_code}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{assembly.budgeted_qty.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs font-normal">{assembly.uom}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{assembly.budgeted_hours}</TableCell>
                    <TableCell className="text-center">
                      {crewSize > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="text-xs gap-1 cursor-help">
                              <Users className="h-3 w-3" />{crewSize}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-0.5">
                              {assembly.crew_template.map((m) => (
                                <p key={m.role} className="text-xs">{m.count}x {m.role}</p>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {totalBudget > 0
                        ? `$${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeProvisionalCode(assembly.wbs_code)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* STICKY FOOTER */}
      {provisionalAssemblies.length > 0 && (
        <div className="shrink-0 bg-white border-t-2">
          <Table>
            <TableBody>
              <TableRow className="font-semibold bg-muted/30 h-12">
                <TableCell className="w-10" />
                <TableCell className="w-[280px] text-sm">Totals ({provisionalCodes.length} code{provisionalCodes.length !== 1 ? "s" : ""})</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono text-sm">{totalBudgetQty.toLocaleString()}</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono text-sm">{totalBudgetHrs.toLocaleString()}</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono text-sm font-bold">${totalBudgetAmt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</TableCell>
                <TableCell className="w-10" />
              </TableRow>
            </TableBody>
          </Table>
          <div className="bg-white border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
            <p className="text-sm text-muted-foreground">
              {provisionalCodes.length} provisional code{provisionalCodes.length !== 1 ? "s" : ""} ready for field reporting.
            </p>
            <Link href="/capture">
              <Button className="gap-1.5 h-8 text-xs" style={{ backgroundColor: "var(--figma-cta-p1-bg)", color: "var(--figma-cta-p1-text)" }}>
                Continue to Capture
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddCodesModal open={addCodesOpen} onOpenChange={setAddCodesOpen} />
      <CodeCreatorModal open={createCodeOpen} onOpenChange={setCreateCodeOpen} />
    </div>
    </TooltipProvider>
  );
}
