"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Settings,
  BarChart3,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/tickets", label: "Tickets", icon: Inbox },
  { href: "/settings", label: "Team", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Zap className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">StudyFlash Support</span>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Demo Mode</span>
          </div>
        </div>
      )}
    </aside>
  );
}
