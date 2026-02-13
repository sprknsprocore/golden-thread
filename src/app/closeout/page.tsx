"use client";

import { Badge } from "@/components/ui/badge";
import { CloseoutPanel } from "@/components/closeout-panel";
import { useProductionStore } from "@/store/use-production-store";

export default function CloseoutPage() {
  const { provisionalCodes, productionEvents } = useProductionStore();

  const codesWithData = provisionalCodes.filter((code) =>
    productionEvents.some((e) => e.wbs_code === code)
  ).length;

  return (
    <div className="space-y-0">
      {/* Control bar */}
      <div
        className="bg-white border-b px-6 py-2.5 flex items-center justify-between"
        style={{ borderColor: "var(--figma-bg-outline)" }}
      >
        <p className="text-sm text-muted-foreground">
          Review final production rates and push validated data back to
          estimating.
        </p>

        {codesWithData > 0 && (
          <Badge variant="secondary" className="text-xs">
            {codesWithData} of {provisionalCodes.length} codes ready
          </Badge>
        )}
      </div>

      <div className="p-6">
        <CloseoutPanel />
      </div>
    </div>
  );
}
