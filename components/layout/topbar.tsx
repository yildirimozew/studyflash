"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function Topbar() {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/gmail", { method: "POST" });
      const data = await res.json();
      if (data.errors?.length && !data.newMessages) {
        toast.info(data.errors[0]);
      } else {
        toast.success(
          `Synced ${data.newMessages} new message(s), ${data.newTickets} new ticket(s)`
        );
      }
      router.refresh();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-1.5", syncing && "animate-spin")} />
          {syncing ? "Syncing..." : "Sync Gmail"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
