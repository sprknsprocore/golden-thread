"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  ClipboardList,
  Scale,
  BarChart3,
  FlagTriangleRight,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const workflowItems = [
  { href: "/setup", label: "Setup", description: "Define scope & codes", icon: Settings },
  { href: "/capture", label: "Capture", description: "Daily log & hours", icon: ClipboardList },
  { href: "/reconciliation", label: "True-Up", description: "PM reconciliation", icon: Scale },
];

const reportingItems = [
  { href: "/analysis", label: "Analysis", description: "Budget vs reality", icon: BarChart3 },
  { href: "/closeout", label: "Closeout", description: "Push to estimating", icon: FlagTriangleRight },
];

export function NavSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card min-h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">Golden Thread</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Production Management
        </p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {/* Dashboard */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            isActive("/")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>

        {/* Workflow section */}
        <div className="pt-3">
          <p className="px-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Workflow
          </p>
          {workflowItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              <div className="min-w-0">
                <p className="truncate">{item.label}</p>
              </div>
            </Link>
          ))}
        </div>

        <Separator className="my-2" />

        {/* Reporting section */}
        <div>
          <p className="px-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Reporting
          </p>
          {reportingItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              <div className="min-w-0">
                <p className="truncate">{item.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Prototype v0.2
        </p>
      </div>
    </aside>
  );
}
