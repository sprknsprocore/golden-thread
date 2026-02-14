"use client";

import { Search, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CloseoutPanel } from "@/components/closeout-panel";
import { useProductionStore } from "@/store/use-production-store";

export default function CloseoutPage() {
  const { provisionalCodes, productionEvents, projectMetadata } = useProductionStore();

  const codesWithData = provisionalCodes.filter((code) =>
    productionEvents.some((e) => e.wbs_code === code)
  ).length;

  return (
    <div className="flex flex-col h-full">

      {/* PAGE HEADER */}
      <div className="shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            Home &middot; {projectMetadata.name} &middot; Financial Management
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Closeout</h1>
        </div>
        {codesWithData > 0 && (
          <Badge variant="secondary" className="text-xs">
            {codesWithData} of {provisionalCodes.length} codes ready
          </Badge>
        )}
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
        </div>
        <p className="text-xs text-muted-foreground">
          Review final production rates and push validated data back to estimating.
        </p>
      </div>

      {/* TABLE — full-bleed, no padding */}
      <CloseoutPanel />
    </div>
  );
}
