"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface TicketMeta {
  id: string;
  externalId: string | null;
  status: string;
  priority: string;
  category: string | null;
  tags: string[];
  detectedLanguage: string | null;
  customerEmail: string | null;
  customerName: string | null;
  assigneeId: string | null;
  createdAt: string;
}

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function TicketSidebar({
  ticket,
  users,
}: {
  ticket: TicketMeta;
  users: User[];
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);

  const updateTicket = async (field: string, value: string | null) => {
    setUpdating(field);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Updated ${field}`);
      router.refresh();
    } catch {
      toast.error(`Failed to update ${field}`);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Status">
            <Select
              value={ticket.status}
              onValueChange={(v) => updateTicket("status", v)}
              disabled={updating === "status"}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Priority">
            <Select
              value={ticket.priority}
              onValueChange={(v) => updateTicket("priority", v)}
              disabled={updating === "priority"}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Assignee">
            <Select
              value={ticket.assigneeId || "unassigned"}
              onValueChange={(v) =>
                updateTicket("assigneeId", v === "unassigned" ? null : v)
              }
              disabled={updating === "assigneeId"}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Separator />

          <Field label="Category">
            <span className="text-sm">{ticket.category || "—"}</span>
          </Field>

          {ticket.tags.length > 0 && (
            <Field label="Tags">
              <div className="flex flex-wrap gap-1">
                {ticket.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </Field>
          )}

          <Separator />

          <Field label="Language">
            <span className="text-sm">
              {ticket.detectedLanguage?.toUpperCase() || "—"}
            </span>
          </Field>

          <Field label="Customer">
            <div className="text-sm">
              <div>{ticket.customerName || "Unknown"}</div>
              {ticket.customerEmail && (
                <div className="text-xs text-muted-foreground">
                  {ticket.customerEmail}
                </div>
              )}
            </div>
          </Field>

          <Field label="Ticket ID">
            <span className="font-mono text-xs text-muted-foreground">
              #{ticket.externalId || ticket.id.slice(0, 8)}
            </span>
          </Field>

          <Field label="Created">
            <span className="text-xs text-muted-foreground">
              {new Date(ticket.createdAt).toLocaleString()}
            </span>
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}
