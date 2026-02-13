"use client";

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProcoreTopBar } from "@/components/procore-top-bar";
import { ProcoreTabs } from "@/components/procore-tabs";
import { DemoBanner } from "@/components/demo-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-screen">
        <ProcoreTopBar />
        <ProcoreTabs />
        <DemoBanner />
        <main className="flex-1 overflow-auto bg-figma-bg-depth1">
          {children}
        </main>
      </div>
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  );
}
