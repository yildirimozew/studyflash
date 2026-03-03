import { prisma } from "@/lib/prisma";
import { TicketTable } from "@/components/tickets/ticket-table";
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { Suspense } from "react";
import { Prisma } from "@/lib/generated/prisma/client";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function TicketsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const limit = 20;

  const where: Prisma.TicketWhereInput = {};

  if (params.status)
    where.status = params.status as Prisma.TicketWhereInput["status"];
  if (params.priority)
    where.priority = params.priority as Prisma.TicketWhereInput["priority"];
  if (params.category) where.category = params.category;
  if (params.assigneeId) {
    where.assigneeId =
      params.assigneeId === "unassigned" ? null : params.assigneeId;
  }
  if (params.search) {
    where.OR = [
      { subject: { contains: params.search, mode: "insensitive" } },
      { translatedSubject: { contains: params.search, mode: "insensitive" } },
      { customerName: { contains: params.search, mode: "insensitive" } },
      { externalId: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  const serialized = tickets.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <span className="text-sm text-muted-foreground">{total} total</span>
      </div>

      <Suspense>
        <TicketFilters />
      </Suspense>

      <div className="rounded-lg border bg-card">
        <Suspense>
          <TicketTable
            tickets={serialized}
            pagination={{
              page,
              limit,
              total,
              totalPages: Math.ceil(total / limit),
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
