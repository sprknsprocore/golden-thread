"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Filter,
  Play,
  RotateCcw,
  Settings,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Pencil,
  Plus,
  Trash2,
  ArrowRightLeft,
  Info,
  ChevronsUpDown,
  X,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useProductionStore } from "@/store/use-production-store";
import type { Assembly, WorkPackageComponent } from "@/store/use-production-store";
import { aggregateEvents } from "@/lib/calculations";
import {
  calcAllComponents,
  calcAssemblyEAC,
  generateNarrative,
  generateEACNarrative,
  type ComponentAnalysis,
} from "@/lib/work-package-calculations";
import { cn } from "@/lib/utils";

/* ================================================================
   Helpers
   ================================================================ */

function fmtHrs(v: number): string { return v.toFixed(1); }
function fmtRate(v: number, uom: string): string { return `${v.toFixed(2)} ${uom}/hr`; }
function fmtDollar(v: number): string {
  const sign = v >= 0 ? "" : "-";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const UOM_OPTIONS = ["LF", "SQFT", "EA", "CY", "TON", "SF", "SY"];

/* ================================================================
   Status Pills (Procore Pill component pattern)
   ================================================================ */

function VariancePill({ flag, pct }: { flag: string; pct: number }) {
  const absPct = Math.abs(pct).toFixed(0);
  if (flag === "ahead") return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-green-500 bg-green-50 px-2 py-0.5 text-[10px] font-mono font-medium text-green-700 leading-none">
      <TrendingUp className="h-3 w-3" />+{absPct}%
    </span>
  );
  if (flag === "behind") return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-red-500 bg-red-50 px-2 py-0.5 text-[10px] font-mono font-medium text-red-700 leading-none">
      <TrendingDown className="h-3 w-3" />-{absPct}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground leading-none">
      <Minus className="h-3 w-3" />OK
    </span>
  );
}

function StatusPill({ overrun }: { overrun: number }) {
  if (overrun > 0.5) return (
    <span className="inline-flex items-center rounded-full border border-red-500 bg-red-50 px-2 py-0.5 text-[10px] font-mono font-medium text-red-700 leading-none">
      +{overrun.toFixed(1)}h
    </span>
  );
  if (overrun < -0.5) return (
    <span className="inline-flex items-center rounded-full border border-green-500 bg-green-50 px-2 py-0.5 text-[10px] font-mono font-medium text-green-700 leading-none">
      -{Math.abs(overrun).toFixed(1)}h
    </span>
  );
  return (
    <span className="inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground leading-none">
      On&nbsp;Track
    </span>
  );
}

/* ================================================================
   Component Tearsheet
   ================================================================ */

interface TearsheetProps {
  assembly: Assembly;
  component: WorkPackageComponent;
  analysis: ComponentAnalysis | null;
  eacComponent: (ComponentAnalysis & { hours_at_completion: number; projected_overrun_hrs: number; recovery_rate: number; can_recover: boolean }) | null;
  actualHours: number;
  onClose: () => void;
}

function ComponentTearsheet({ assembly, component, analysis, eacComponent, actualHours, onClose }: TearsheetProps) {
  const { updateAssemblyComponent, updateComponentByRate, setComponentQtyInstalled, removeAssemblyComponent } = useProductionStore();
  const [entryMode, setEntryMode] = useState<"hours" | "rate">("hours");
  const wbs = assembly.wbs_code;
  const narrative = analysis ? generateNarrative(analysis, actualHours) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <p className="text-xs text-muted-foreground font-mono mb-1">{assembly.wbs_code} &middot; {assembly.description}</p>
        <h2 className="text-lg font-semibold leading-tight">{component.name}</h2>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-[10px]">{component.uom}</Badge>
          <Badge variant="outline" className="text-[10px] font-mono">{(component.weight * 100).toFixed(1)}% weight</Badge>
          {analysis && analysis.qty_installed > 0 && analysis.earned_hours > 0 && (
            <VariancePill flag={analysis.variance_flag} pct={analysis.variance_pct} />
          )}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Budget Setup */}
        <div className="px-6 py-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Budget Setup</h4>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Component Name</Label>
              <Input className="h-7 text-sm mt-1" value={component.name} onChange={(e) => updateAssemblyComponent(wbs, component.id, { name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">UOM</Label>
                <Select value={component.uom} onValueChange={(val) => updateAssemblyComponent(wbs, component.id, { uom: val })}>
                  <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{UOM_OPTIONS.map((u) => (<SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Plan Qty</Label>
                <Input type="number" min={0} className="h-7 text-sm font-mono mt-1" value={component.plan_qty || ""} onChange={(e) => updateAssemblyComponent(wbs, component.id, { plan_qty: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">{entryMode === "hours" ? "Budgeted Hours" : "Production Rate"}</Label>
                <button className="flex items-center gap-1 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded hover:bg-muted/50" onClick={() => setEntryMode(entryMode === "hours" ? "rate" : "hours")}>
                  <ArrowRightLeft className="h-3 w-3" />Switch to {entryMode === "hours" ? "Rate" : "Hours"}
                </button>
              </div>
              {entryMode === "hours" ? (
                <Input type="number" min={0} step={0.5} className="h-7 text-sm font-mono" value={component.budgeted_hours || ""} onChange={(e) => updateAssemblyComponent(wbs, component.id, { budgeted_hours: parseFloat(e.target.value) || 0 })} />
              ) : (
                <Input type="number" min={0} step={0.1} className="h-7 text-sm font-mono" placeholder={`${component.uom}/hr`} value={component.production_rate ? component.production_rate.toFixed(2) : ""} onChange={(e) => updateComponentByRate(wbs, component.id, component.plan_qty, parseFloat(e.target.value) || 0)} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-px rounded-md overflow-hidden border">
              {[{ label: "Total Hours", value: component.budgeted_hours.toFixed(1) }, { label: "Bid Rate", value: component.budgeted_hours > 0 ? (component.plan_qty / component.budgeted_hours).toFixed(2) : "—" }, { label: "Weight", value: `${(component.weight * 100).toFixed(1)}%` }].map((item) => (
                <div key={item.label} className="bg-muted/20 px-3 py-2 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                  <p className="text-sm font-mono font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Separator />
        {/* Field Progress */}
        <div className="px-6 py-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Field Progress</h4>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Qty Installed</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={0} className="h-7 text-sm font-mono flex-1" value={component.qty_installed || ""} onChange={(e) => setComponentQtyInstalled(wbs, component.id, parseFloat(e.target.value) || 0)} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">of {component.plan_qty} {component.uom}</span>
              </div>
            </div>
            {component.plan_qty > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Progress</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{(Math.min(component.qty_installed / component.plan_qty, 1) * 100).toFixed(0)}%</span>
                </div>
                <Progress value={Math.min((component.qty_installed / component.plan_qty) * 100, 100)} className="h-1.5" />
              </div>
            )}
          </div>
        </div>
        {/* Performance */}
        {analysis && analysis.qty_installed > 0 && analysis.earned_hours > 0 && (
          <>
            <Separator />
            <div className="px-6 py-5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">Performance</h4>
              <div className="grid grid-cols-2 gap-px rounded-md overflow-hidden border">
                {[{ label: "Earned Hours", value: analysis.earned_hours.toFixed(2) }, { label: "Earned Value", value: `${analysis.earned_value.toFixed(2)} hrs` }, { label: "Bid Rate", value: fmtRate(analysis.bid_rate, analysis.uom) }, { label: "Inferred Rate", value: fmtRate(analysis.inferred_rate, analysis.uom) }].map((item) => (
                  <div key={item.label} className="bg-muted/20 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                    <p className="text-sm font-mono font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
              {narrative && (
                <div className={cn("mt-3 p-3 rounded-md border text-xs leading-relaxed", analysis.variance_flag === "behind" ? "bg-red-50/50 border-red-200" : analysis.variance_flag === "ahead" ? "bg-green-50/50 border-green-200" : "bg-muted/30")}>
                  {narrative}
                </div>
              )}
            </div>
          </>
        )}
        {/* EAC */}
        {eacComponent && eacComponent.qty_installed > 0 && (
          <>
            <Separator />
            <div className="px-6 py-5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">EAC Projection</h4>
              <div className="grid grid-cols-2 gap-px rounded-md overflow-hidden border">
                {[
                  { label: "Hrs at Completion", value: eacComponent.hours_at_completion.toFixed(1), cls: "" },
                  { label: "Projected Overrun", value: `${eacComponent.projected_overrun_hrs > 0 ? "+" : ""}${eacComponent.projected_overrun_hrs.toFixed(1)} hrs`, cls: eacComponent.projected_overrun_hrs > 0.5 ? "text-red-700" : eacComponent.projected_overrun_hrs < -0.5 ? "text-green-700" : "" },
                  { label: "Recovery Rate", value: fmtRate(eacComponent.recovery_rate, component.uom), cls: "" },
                  { label: "Recoverable", value: eacComponent.can_recover ? "Yes" : "At Risk", cls: eacComponent.can_recover ? "text-green-700" : "text-red-700" },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/20 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                    <p className={cn("text-sm font-mono font-semibold", item.cls)}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {/* Footer */}
      <div className="shrink-0 border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <button className="flex items-center gap-1 text-xs text-red-600 px-2 py-1 rounded hover:bg-red-50" onClick={() => { removeAssemblyComponent(wbs, component.id); onClose(); }}>
          <Trash2 className="h-3.5 w-3.5" />Remove
        </button>
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

/* ================================================================
   Main Component
   ================================================================ */

export function WorkPackageBuilder() {
  const { assemblies, productionEvents, setComponentQtyInstalled, addAssemblyComponent, seedDemoScenario, resetStore } = useProductionStore();

  const wpAssemblies = useMemo(() => assemblies.filter((a) => a.components && a.components.length > 0), [assemblies]);

  const [expandedWbs, setExpandedWbs] = useState<Set<string>>(new Set());
  const [showWpOnly, setShowWpOnly] = useState(true);
  const [tearsheetOpen, setTearsheetOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<{ wbs: string; compId: string } | null>(null);

  const toggleExpand = (wbs: string) => {
    setExpandedWbs((prev) => { const next = new Set(prev); if (next.has(wbs)) next.delete(wbs); else next.add(wbs); return next; });
  };
  const expandAll = () => {
    const all = displayAssemblies.filter((a) => (a.components?.length ?? 0) > 0).map((a) => a.wbs_code);
    setExpandedWbs((prev) => prev.size === all.length ? new Set() : new Set(all));
  };
  const openTearsheet = (wbs: string, compId: string) => {
    setSelectedComponent({ wbs, compId }); setActiveRow(`${wbs}-${compId}`); setTearsheetOpen(true);
  };
  const closeTearsheet = () => { setTearsheetOpen(false); setActiveRow(null); };

  const displayAssemblies = showWpOnly ? wpAssemblies : assemblies;

  const rowData = useMemo(() => displayAssemblies.map((assembly) => {
    const agg = aggregateEvents(productionEvents, assembly.wbs_code);
    const hasComponents = (assembly.components?.length ?? 0) > 0;
    const analyses = hasComponents ? calcAllComponents(assembly, agg.totalHours) : [];
    const eac = hasComponents ? calcAssemblyEAC(assembly, agg.totalHours) : null;
    return { assembly, actualHours: agg.totalHours, hasComponents, analyses, eac, totalQty: agg.totalQty };
  }), [displayAssemblies, productionEvents]);

  const totalBudgetedHrs = rowData.reduce((s, r) => s + r.assembly.budgeted_hours, 0);
  const totalActualHrs = rowData.reduce((s, r) => s + r.actualHours, 0);
  const totalEacHrs = rowData.reduce((s, r) => s + (r.eac && r.eac.weighted_progress > 0 ? r.eac.total_hours_at_completion : r.assembly.budgeted_hours), 0);
  const totalDollarImpact = rowData.reduce((s, r) => s + (r.eac?.dollar_impact ?? 0), 0);

  const selectedAssembly = selectedComponent ? assemblies.find((a) => a.wbs_code === selectedComponent.wbs) : null;
  const selectedComp = selectedAssembly?.components?.find((c) => c.id === selectedComponent?.compId) ?? null;
  const selectedActualHours = selectedComponent ? aggregateEvents(productionEvents, selectedComponent.wbs).totalHours : 0;
  const selectedAnalysis = selectedComponent && selectedAssembly ? (calcAllComponents(selectedAssembly, selectedActualHours).find((a) => a.id === selectedComponent.compId) ?? null) : null;
  const selectedEac = selectedComponent && selectedAssembly ? (calcAssemblyEAC(selectedAssembly, selectedActualHours).components.find((c) => c.id === selectedComponent.compId) ?? null) : null;

  const hasSeededData = productionEvents.length > 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">

        {/* ============================================================ */}
        {/* PAGE HEADER — Procore pattern: title + primary actions       */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              Home &middot; {assemblies.length > 0 ? "Western Boone High School Tennis" : "Project"} &middot; Financial Management
            </p>
            <h1 className="text-xl font-semibold tracking-tight">Work Packages</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={resetStore}>
              <RotateCcw className="h-3.5 w-3.5" />Reset
            </Button>
            <Button
              size="sm" className="gap-1.5 text-xs h-8"
              style={{ backgroundColor: "var(--figma-cta-p1-bg)", color: "var(--figma-cta-p1-text)" }}
              onClick={() => { seedDemoScenario(); setExpandedWbs(new Set(["03-310.SDCR"])); }}
              disabled={hasSeededData}
            >
              <Plus className="h-3.5 w-3.5" />Seed Demo Data
            </Button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CONTENT CONTROLS — search, filter, tokens, density           */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-white border-b px-6 py-2 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
          <div className="flex items-center gap-2">
            {/* Search (placeholder) */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md w-48 bg-white" style={{ borderColor: "var(--figma-bg-outline)" }}>
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Search...</span>
            </div>

            {/* Filter button */}
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-md text-muted-foreground hover:bg-muted/30 transition-colors" style={{ borderColor: "var(--figma-bg-outline)" }}>
              <Filter className="h-3.5 w-3.5" />Filter
            </button>

            {/* Active filter tokens */}
            {showWpOnly && (
              <button
                onClick={() => setShowWpOnly(false)}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
              >
                Has Components
                <X className="h-3 w-3" />
              </button>
            )}
            {!showWpOnly && (
              <button
                onClick={() => setShowWpOnly(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                + Add filter
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Expand/collapse */}
            {wpAssemblies.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={expandAll} className="flex items-center gap-1 px-2 py-1.5 text-xs border rounded-md text-muted-foreground hover:bg-muted/30 transition-colors" style={{ borderColor: "var(--figma-bg-outline)" }}>
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">{expandedWbs.size === displayAssemblies.filter((a) => (a.components?.length ?? 0) > 0).length ? "Collapse all" : "Expand all"}</p></TooltipContent>
              </Tooltip>
            )}

            {/* Density placeholder */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Density: Medium</span>
            </div>

            {/* List view indicator */}
            <div className="flex items-center border rounded-md overflow-hidden" style={{ borderColor: "var(--figma-bg-outline)" }}>
              <button className="px-2 py-1.5 text-xs bg-muted/50 text-foreground font-medium"><List className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DATA TABLE                                                   */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-auto">
          {displayAssemblies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6">
              <Settings className="h-10 w-10 text-muted-foreground/30 mb-4" />
              <h3 className="text-base font-semibold mb-1">No work packages defined</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Click &ldquo;Seed Demo Data&rdquo; to load the Shallow Depth Concrete Repair assembly with 5 components and 3 days of production events.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10 sticky top-0 z-10">
                  <TableHead className="w-[260px] text-xs font-medium">Description</TableHead>
                  <TableHead className="text-right text-xs font-medium w-[80px]">Budget Hrs</TableHead>
                  <TableHead className="text-right text-xs font-medium w-[80px]">Actual Hrs</TableHead>
                  <TableHead className="text-center text-xs font-medium w-[90px]">% Complete</TableHead>
                  <TableHead className="text-right text-xs font-medium w-[90px]">Installed</TableHead>
                  <TableHead className="text-right text-xs font-medium w-[80px]">Earned Hrs</TableHead>
                  <TableHead className="text-right text-xs font-medium w-[80px]">Bid Rate</TableHead>
                  <TableHead className="text-right text-xs font-medium w-[80px]">Actual Rate</TableHead>
                  <TableHead className="text-center text-xs font-medium w-[70px]">Variance</TableHead>
                  <TableHead className="text-right text-xs font-medium w-[70px]">EAC Hrs</TableHead>
                  <TableHead className="text-center text-xs font-medium w-[80px]">EAC Status</TableHead>
                  <TableHead className="w-[48px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowData.map(({ assembly, actualHours, hasComponents, analyses, eac }) => {
                  const isExpanded = expandedWbs.has(assembly.wbs_code);
                  const wp = eac?.weighted_progress ?? 0;

                  return (
                    <Fragment key={assembly.wbs_code}>
                      {/* Assembly Row */}
                      <TableRow className={cn("h-12", hasComponents && "cursor-pointer hover:bg-muted/10")} onClick={hasComponents ? () => toggleExpand(assembly.wbs_code) : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {hasComponents ? (isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />) : <span className="w-4" />}
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">{assembly.description}</p>
                              <p className="text-xs text-muted-foreground font-mono">{assembly.wbs_code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">{assembly.budgeted_hours.toFixed(0)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{actualHours > 0 ? <span className={actualHours > assembly.budgeted_hours ? "text-red-700" : ""}>{fmtHrs(actualHours)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{wp > 0 ? <div className="flex items-center gap-1.5 px-1"><Progress value={wp * 100} className="h-1.5 flex-1" /><span className="text-[11px] font-mono w-8 text-right">{(wp * 100).toFixed(0)}%</span></div> : <span className="block text-center text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">{assembly.budgeted_qty} {assembly.uom}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-center">{eac && eac.weighted_progress > 0 ? <StatusPill overrun={eac.total_projected_overrun_hrs} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{eac && eac.weighted_progress > 0 ? fmtHrs(eac.total_hours_at_completion) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-center">{eac && eac.dollar_impact !== 0 ? <span className={cn("text-[10px] font-mono font-semibold", eac.dollar_impact > 0 ? "text-red-700" : "text-green-700")}>{fmtDollar(eac.dollar_impact)}</span> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell />
                      </TableRow>

                      {/* Component Rows */}
                      {isExpanded && analyses.map((ca) => {
                        const eacComp = eac?.components.find((c) => c.id === ca.id);
                        const hasData = ca.qty_installed > 0 && ca.earned_hours > 0;
                        const rowKey = `${assembly.wbs_code}-${ca.id}`;
                        const isActive = activeRow === rowKey;

                        return (
                          <TableRow key={rowKey} className={cn("h-12 cursor-pointer group", isActive ? "bg-blue-50/60" : "hover:bg-muted/5")} onClick={() => openTearsheet(assembly.wbs_code, ca.id)}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={cn("w-[3px] h-8 rounded-full flex-shrink-0 transition-colors", isActive ? "bg-blue-500" : "bg-transparent")} />
                                <CornerDownRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                <span className="text-sm">{ca.name}</span>
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal">{ca.uom}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{ca.budgeted_hours.toFixed(1)} <span className="text-[9px] text-muted-foreground">({ca.weight_pct.toFixed(0)}%)</span></TableCell>
                            <TableCell className="text-right font-mono text-xs">{hasData ? fmtHrs(ca.earned_hours) : <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell><div className="flex items-center gap-1 px-1"><Progress value={ca.progress_pct * 100} className="h-1.5 flex-1" /><span className="text-[10px] font-mono w-8 text-right">{(ca.progress_pct * 100).toFixed(0)}%</span></div></TableCell>
                            <TableCell className="text-right font-mono text-xs">{ca.qty_installed}/{ca.plan_qty} <span className="text-[9px] text-muted-foreground">{ca.uom}</span></TableCell>
                            <TableCell className="text-right font-mono text-xs">{hasData ? fmtHrs(ca.earned_hours) : <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{ca.bid_rate.toFixed(2)} <span className="text-[9px] text-muted-foreground">{ca.uom}/hr</span></TableCell>
                            <TableCell className="text-right font-mono text-xs">{hasData ? <>{ca.inferred_rate.toFixed(2)} <span className="text-[9px] text-muted-foreground">{ca.uom}/hr</span></> : <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-center">{hasData ? <VariancePill flag={ca.variance_flag} pct={ca.variance_pct} /> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{eacComp && ca.qty_installed > 0 ? fmtHrs(eacComp.hours_at_completion) : <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-center">{eacComp && ca.qty_installed > 0 ? <StatusPill overrun={eacComp.projected_overrun_hrs} /> : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-center">
                              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted/50" onClick={(e) => { e.stopPropagation(); openTearsheet(assembly.wbs_code, ca.id); }}>
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Add Component */}
                      {isExpanded && (
                        <TableRow className="h-8">
                          <TableCell colSpan={12}>
                            <div className="pl-8">
                              <button className="flex items-center gap-1 text-[11px] text-muted-foreground px-1.5 py-0.5 rounded hover:bg-muted/30" onClick={() => addAssemblyComponent(assembly.wbs_code, { id: `comp_${Date.now()}`, name: "New Component", plan_qty: 0, uom: "EA", budgeted_hours: 0, qty_installed: 0 })}>
                                <Plus className="h-3 w-3" />Add Component
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Group Footer — EAC narrative */}
                      {isExpanded && eac && eac.weighted_progress > 0 && (
                        <TableRow className="h-10 border-b-2 bg-muted/5">
                          <TableCell colSpan={12}>
                            <div className="flex items-start gap-2 pl-8">
                              <Info className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", eac.total_projected_overrun_hrs > 0.5 ? "text-red-700" : "text-green-700")} />
                              <p className="text-xs leading-relaxed text-muted-foreground">{generateEACNarrative(eac, assembly)}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* STICKY FOOTER — totals */}
        {rowData.length > 0 && (
          <div className="shrink-0 bg-white border-t-2">
            <Table>
              <TableBody>
                <TableRow className="font-semibold bg-muted/30 h-12">
                  <TableCell className="w-[260px] text-sm">Totals</TableCell>
                  <TableCell className="text-right font-mono text-sm w-[80px]">{totalBudgetedHrs.toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono text-sm w-[80px]">{totalActualHrs > 0 ? fmtHrs(totalActualHrs) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="w-[90px]" /><TableCell className="w-[90px]" /><TableCell className="w-[80px]" /><TableCell className="w-[80px]" /><TableCell className="w-[80px]" /><TableCell className="w-[70px]" />
                  <TableCell className="text-right font-mono text-sm w-[70px]">{totalActualHrs > 0 ? fmtHrs(totalEacHrs) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-center w-[80px]">{totalDollarImpact !== 0 ? <span className={cn("text-xs font-mono font-bold", totalDollarImpact > 0 ? "text-red-700" : "text-green-700")}>{fmtDollar(totalDollarImpact)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="w-[48px]" />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* TEARSHEET */}
      <Sheet open={tearsheetOpen} onOpenChange={(open) => { if (!open) closeTearsheet(); }}>
        <SheetContent side="right" className="p-0 w-[520px] sm:max-w-[520px]">
          <SheetHeader className="sr-only"><SheetTitle>Component Detail</SheetTitle><SheetDescription>Edit component budget and view performance</SheetDescription></SheetHeader>
          {selectedAssembly && selectedComp && <ComponentTearsheet assembly={selectedAssembly} component={selectedComp} analysis={selectedAnalysis} eacComponent={selectedEac ?? null} actualHours={selectedActualHours} onClose={closeTearsheet} />}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
