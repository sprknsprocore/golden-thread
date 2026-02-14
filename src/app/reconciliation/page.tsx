"use client";

import { useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReconciliationTable } from "@/components/reconciliation-table";
import { useProductionStore } from "@/store/use-production-store";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "flagged" | "reviewed";

export default function ReconciliationPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const { projectMetadata } = useProductionStore();

  return (
    <div className="flex flex-col h-full">

      {/* PAGE HEADER */}
      <div className="shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            Home &middot; {projectMetadata.name} &middot; Financial Management
          </p>
          <h1 className="text-xl font-semibold tracking-tight">True-Up</h1>
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

          {/* Active filter tokens */}
          {filter !== "all" && (
            <button
              onClick={() => setFilter("all")}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
            >
              Status: {filter.charAt(0).toUpperCase() + filter.slice(1)}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          {(
            [
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "flagged", label: "Flagged" },
              { key: "reviewed", label: "Reviewed" },
            ] as const
          ).map((opt) => (
            <Button
              key={opt.key}
              variant={filter === opt.key ? "default" : "ghost"}
              size="sm"
              className={cn(
                "text-xs h-7",
                filter !== opt.key && "text-muted-foreground"
              )}
              onClick={() => setFilter(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-auto p-6">
        <ReconciliationTable statusFilter={filter} />
      </div>
    </div>
  );
}
