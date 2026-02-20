"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Users, PenLine, Search, Filter, ArrowRight, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailyLog } from "@/components/daily-log";
import { UnifiedGrid } from "@/components/unified-grid";
import { WeeklyGrid } from "@/components/weekly-grid";
import { MaterialDrawdown } from "@/components/material-drawdown";
import { useProductionStore } from "@/store/use-production-store";
import { cn } from "@/lib/utils";

type CaptureMode = "weekly" | "daily-log" | "manual";

const modeDescriptions: Record<CaptureMode, string> = {
  weekly:
    "Weekly production report — enter hours and units per code per day.",
  "daily-log":
    "Tag crew members from kiosk clock-ins to auto-aggregate hours per code.",
  manual:
    "Direct manual entry for labor hours, equipment, and units installed.",
};

export default function CapturePage() {
  const [mode, setMode] = useState<CaptureMode>("weekly");
  const { projectMetadata, productionEvents } = useProductionStore();

  const hasProductionData = productionEvents.length > 0;

  return (
    <div className="flex flex-col h-full">

      {/* PAGE HEADER */}
      <div className="shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            Home &middot; {projectMetadata.name} &middot; Financial Management
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Field Capture</h1>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={mode === "weekly" ? "default" : "ghost"}
            size="sm"
            className={cn("gap-1.5 text-xs h-7", mode !== "weekly" && "text-muted-foreground")}
            onClick={() => setMode("weekly")}
          >
            <CalendarDays className="h-3.5 w-3.5" />Weekly Grid
          </Button>
          <Button
            variant={mode === "daily-log" ? "default" : "ghost"}
            size="sm"
            className={cn("gap-1.5 text-xs h-7", mode !== "daily-log" && "text-muted-foreground")}
            onClick={() => setMode("daily-log")}
          >
            <Users className="h-3.5 w-3.5" />Daily Log
          </Button>
          <Button
            variant={mode === "manual" ? "default" : "ghost"}
            size="sm"
            className={cn("gap-1.5 text-xs h-7", mode !== "manual" && "text-muted-foreground")}
            onClick={() => setMode("manual")}
          >
            <PenLine className="h-3.5 w-3.5" />Manual Entry
          </Button>
        </div>
      </div>

      {/* CONTENT — weekly mode gets full-bleed table, other modes get padded layout */}
      {mode === "weekly" ? (
        <WeeklyGrid />
      ) : (
        <>
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
            <p className="text-xs text-muted-foreground">{modeDescriptions[mode]}</p>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
              <div className="min-w-0">
                {mode === "daily-log" ? <DailyLog /> : <UnifiedGrid />}
              </div>
              <div className="space-y-4"><MaterialDrawdown /></div>
            </div>
          </div>
        </>
      )}

      {/* STICKY FOOTER — Continue to True-Up */}
      {hasProductionData && (
        <div className="shrink-0 bg-white border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: "var(--figma-bg-outline)" }}>
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {productionEvents.length} production event{productionEvents.length !== 1 ? "s" : ""} logged. Ready for PM review.
            </p>
          </div>
          <Link href="/reconciliation">
            <Button className="gap-1.5 h-8 text-xs" style={{ backgroundColor: "var(--figma-cta-p1-bg)", color: "var(--figma-cta-p1-text)" }}>
              Continue to True-Up
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
