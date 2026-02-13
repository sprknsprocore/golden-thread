"use client";

import { Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DifferentialTable } from "@/components/differential-table";

export default function AnalysisPage() {
  return (
    <TooltipProvider>
    <div className="space-y-0">
      {/* Control bar */}
      <div
        className="bg-white border-b px-6 py-2.5 flex items-center justify-between"
        style={{ borderColor: "var(--figma-bg-outline)" }}
      >
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Budget, hours, and productivity aligned in one view.
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Period</span>
                <button
                  className="flex items-center gap-1 px-2.5 py-1.5 text-sm border rounded-md bg-white opacity-50 cursor-not-allowed"
                  disabled
                >
                  This Week
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent><p>Coming soon</p></TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs opacity-50 cursor-not-allowed" disabled>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent><p>Coming soon</p></TooltipContent>
        </Tooltip>
      </div>

      <div className="p-6">
        <DifferentialTable />
      </div>
    </div>
    </TooltipProvider>
  );
}
