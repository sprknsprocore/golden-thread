"use client";

import { Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProductionStore } from "@/store/use-production-store";
import seedData from "@/data/golden_thread_data.json";
import { cn } from "@/lib/utils";

interface PendingDrawdown {
  item: string;
  qty: number;
}

interface MaterialDrawdownProps {
  pendingDrawdowns?: PendingDrawdown[];
}

export function MaterialDrawdown({ pendingDrawdowns = [] }: MaterialDrawdownProps) {
  const { mockInventory } = useProductionStore();

  const originals = seedData.mock_inventory;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Material Inventory
        </CardTitle>
        <CardDescription>
          Real-time stockroom drawdown as production events are logged
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockInventory.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No inventory items tracked for this project.
          </p>
        )}
        {mockInventory.map((item) => {
          const original = originals.find((o) => o.item === item.item);
          const originalQty = original?.on_hand ?? item.on_hand;

          const pendingQty = pendingDrawdowns
            .filter((d) => d.item === item.item)
            .reduce((sum, d) => sum + d.qty, 0);
          const effectiveOnHand = Math.max(0, item.on_hand - pendingQty);

          const pctRemaining =
            originalQty > 0 ? (effectiveOnHand / originalQty) * 100 : 100;
          const pctCommitted =
            originalQty > 0 ? (item.on_hand / originalQty) * 100 : 100;

          const statusColor =
            pctRemaining > 50
              ? "text-teal-600"
              : pctRemaining > 20
              ? "text-amber-600"
              : "text-red-600";

          const barColor =
            pctRemaining > 50
              ? "[&>div]:bg-teal-400"
              : pctRemaining > 20
              ? "[&>div]:bg-amber-400"
              : "[&>div]:bg-red-400";

          return (
            <div key={item.item} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.item}</span>
                <span className={cn("text-sm font-mono font-semibold", statusColor)}>
                  {effectiveOnHand.toLocaleString()} {item.uom}
                </span>
              </div>
              <Progress value={pctRemaining} className={cn("h-2", barColor)} />
              <p className="text-xs text-muted-foreground">
                {pctRemaining.toFixed(0)}% remaining of{" "}
                {originalQty.toLocaleString()} {item.uom}
                {pendingQty > 0 && (
                  <span className="text-amber-600 ml-1">
                    ({pendingQty.toLocaleString()} pending)
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
