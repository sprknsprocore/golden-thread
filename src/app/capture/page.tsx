"use client";

import { useState } from "react";
import { CalendarDays, Users, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailyLog } from "@/components/daily-log";
import { UnifiedGrid } from "@/components/unified-grid";
import { WeeklyGrid } from "@/components/weekly-grid";
import { MaterialDrawdown } from "@/components/material-drawdown";
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

  return (
    <div className="space-y-0">
      {/* Control bar — Procore-style View/Filter row */}
      <div
        className="bg-white border-b px-6 py-2.5 flex items-center justify-between"
        style={{ borderColor: "var(--figma-bg-outline)" }}
      >
        <p className="text-sm text-muted-foreground">
          {modeDescriptions[mode]}
        </p>

        {/* Mode toggle — styled like Procore's view selector */}
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={mode === "weekly" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "gap-1.5 text-xs h-7",
              mode !== "weekly" && "text-muted-foreground"
            )}
            onClick={() => setMode("weekly")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Weekly Grid
          </Button>
          <Button
            variant={mode === "daily-log" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "gap-1.5 text-xs h-7",
              mode !== "daily-log" && "text-muted-foreground"
            )}
            onClick={() => setMode("daily-log")}
          >
            <Users className="h-3.5 w-3.5" />
            Daily Log
          </Button>
          <Button
            variant={mode === "manual" ? "default" : "ghost"}
            size="sm"
            className={cn(
              "gap-1.5 text-xs h-7",
              mode !== "manual" && "text-muted-foreground"
            )}
            onClick={() => setMode("manual")}
          >
            <PenLine className="h-3.5 w-3.5" />
            Manual Entry
          </Button>
        </div>
      </div>

      <div className="p-6">
        {mode === "weekly" ? (
          /* Weekly grid gets full width with sidebar */
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
            <div className="min-w-0">
              <WeeklyGrid />
            </div>
            <div className="space-y-4">
              <MaterialDrawdown />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
            <div className="min-w-0">
              {mode === "daily-log" ? <DailyLog /> : <UnifiedGrid />}
            </div>
            <div className="space-y-4">
              <MaterialDrawdown />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
