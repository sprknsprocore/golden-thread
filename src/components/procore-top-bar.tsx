"use client";

import { Bell, Building2, ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useProductionStore } from "@/store/use-production-store";

export function ProcoreTopBar() {
  const { projectMetadata } = useProductionStore();

  return (
    <header
      className="h-14 shrink-0 flex items-center px-4 gap-4"
      style={{
        backgroundColor: "var(--figma-topbar-bg)",
        borderBottom: "1px solid var(--figma-topbar-border)",
      }}
    >
      {/* Left: Logo + Project Selector */}
      <div className="flex items-center gap-3">
        {/* App icon */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded flex items-center justify-center font-bold text-xs bg-figma-orange text-figma-cta-p1-text">
            GT
          </div>
        </div>

        {/* Project selector */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors hover:bg-white/10">
          <Building2 className="h-4 w-4" style={{ color: "var(--figma-topbar-text-muted)" }} />
          <div className="text-left">
            <p className="text-sm font-medium leading-tight" style={{ color: "var(--figma-topbar-text)" }}>
              {projectMetadata.name}
            </p>
          </div>
          <Badge
            className="text-[10px] h-5 border-0"
            style={{
              backgroundColor: projectMetadata.status === "Active" ? "rgba(21, 128, 61, 0.15)" : "rgba(255,255,255,0.1)",
              color: projectMetadata.status === "Active" ? "var(--figma-success)" : "var(--figma-topbar-text-muted)",
            }}
          >
            {projectMetadata.status}
          </Badge>
          <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--figma-topbar-text-muted)" }} />
        </button>
      </div>

      {/* Center: Search bar placeholder */}
      <div className="flex-1 flex justify-center">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md w-full max-w-md"
          style={{
            backgroundColor: "var(--figma-topbar-select-bg)",
            border: "1px solid var(--figma-topbar-border)",
          }}
        >
          <Search className="h-3.5 w-3.5" style={{ color: "var(--figma-topbar-text-muted)" }} />
          <span className="text-xs" style={{ color: "var(--figma-topbar-text-muted)" }}>
            Search or ask a question...
          </span>
          <span
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              color: "var(--figma-topbar-text-muted)",
            }}
          >
            Cmd K
          </span>
        </div>
      </div>

      {/* Right: Actions + User */}
      <div className="flex items-center gap-2">
        <button
          className="h-8 w-8 rounded-md flex items-center justify-center transition-colors hover:bg-white/10"
        >
          <Bell className="h-4 w-4" style={{ color: "var(--figma-topbar-text-muted)" }} />
        </button>
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{
            backgroundColor: "var(--figma-nav-avatar-bg)",
            color: "var(--figma-topbar-text)",
          }}
        >
          SP
        </div>
      </div>
    </header>
  );
}
