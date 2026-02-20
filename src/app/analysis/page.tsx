"use client";

import Link from "next/link";
import { Download, ChevronDown, Search, Filter, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DifferentialTable } from "@/components/differential-table";
import { useProductionStore } from "@/store/use-production-store";

export default function AnalysisPage() {
  const { projectMetadata } = useProductionStore();

  return (
    <TooltipProvider>
    <div className="flex flex-col h-full">

      {/* PAGE HEADER */}
      <div className="shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            Home &middot; {projectMetadata.name} &middot; Financial Management
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Analysis</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Link href="/">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Back to Budget
            </Link>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 opacity-50 cursor-not-allowed" disabled>
                  <Download className="h-3.5 w-3.5" />Export
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Coming soon</p></TooltipContent>
          </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-md text-muted-foreground opacity-50 cursor-not-allowed" style={{ borderColor: "var(--figma-bg-outline)" }} disabled>
                Period: This Week
                <ChevronDown className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Coming soon</p></TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground">
          Budget, hours, and productivity aligned in one view.
        </p>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-auto p-6">
        <DifferentialTable />
      </div>
    </div>
    </TooltipProvider>
  );
}
