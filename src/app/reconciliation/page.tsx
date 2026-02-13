"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReconciliationTable } from "@/components/reconciliation-table";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "flagged" | "reviewed";

export default function ReconciliationPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");

  return (
    <div className="space-y-0">
      {/* Control bar */}
      <div
        className="bg-white border-b px-6 py-2.5 flex items-center justify-between"
        style={{ borderColor: "var(--figma-bg-outline)" }}
      >
        <p className="text-sm text-muted-foreground">
          Review field data, accept or adjust quantities, and flag codes needing
          follow-up.
        </p>

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
              {opt.key === "all" && <Filter className="h-3 w-3 mr-1" />}
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <ReconciliationTable statusFilter={filter} />
      </div>
    </div>
  );
}
