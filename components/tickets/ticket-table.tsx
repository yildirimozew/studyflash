"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Assignee {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface Ticket {
  id: string;
  externalId: string | null;
  subject: string;
  translatedSubject: string | null;
  status: string;
  priority: string;
  category: string | null;
  detectedLanguage: string | null;
  customerName: string | null;
  assignee: Assignee | null;
  createdAt: string;
  _count: { messages: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OPEN: "destructive",
  IN_PROGRESS: "default",
  WAITING: "secondary",
  RESOLVED: "outline",
  CLOSED: "outline",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-muted-foreground",
  MEDIUM: "text-foreground",
  HIGH: "text-orange-600",
  URGENT: "text-red-600 font-semibold",
};

const LANG_FLAGS: Record<string, string> = {
  de: "🇩🇪",
  fr: "🇫🇷",
  nl: "🇳🇱",
  it: "🇮🇹",
  en: "🇬🇧",
};

function formatDate(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffHours < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TicketTable({
  tickets,
  pagination,
}: {
  tickets: Ticket[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`/tickets?${params.toString()}`);
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-24">Priority</TableHead>
            <TableHead className="w-40">Category</TableHead>
            <TableHead className="w-36">Assignee</TableHead>
            <TableHead className="w-24 text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                No tickets found.
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((ticket) => (
              <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  <Link href={`/tickets/${ticket.id}`} className="block">
                    {ticket.externalId || ticket.id.slice(0, 6)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/tickets/${ticket.id}`} className="block">
                    <div className="flex items-center gap-2">
                      {ticket.detectedLanguage &&
                        LANG_FLAGS[ticket.detectedLanguage] && (
                          <span className="text-xs">
                            {LANG_FLAGS[ticket.detectedLanguage]}
                          </span>
                        )}
                      <span className="truncate max-w-md font-medium text-sm">
                        {ticket.translatedSubject || ticket.subject}
                      </span>
                      {ticket._count.messages > 1 && (
                        <span className="text-xs text-muted-foreground">
                          ({ticket._count.messages})
                        </span>
                      )}
                    </div>
                    {ticket.customerName && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {ticket.customerName}
                      </div>
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[ticket.status] || "secondary"}>
                    {ticket.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={PRIORITY_COLORS[ticket.priority] || ""}>
                    {ticket.priority}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {ticket.category || "—"}
                </TableCell>
                <TableCell>
                  {ticket.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {ticket.assignee.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">
                        {ticket.assignee.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDate(ticket.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {pagination.total} ticket{pagination.total !== 1 ? "s" : ""} total
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => goToPage(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => goToPage(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
