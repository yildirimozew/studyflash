import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const assigneeId = searchParams.get("assigneeId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const where: Prisma.TicketWhereInput = {};

  if (status) where.status = status as Prisma.TicketWhereInput["status"];
  if (priority) where.priority = priority as Prisma.TicketWhereInput["priority"];
  if (category) where.category = category;
  if (assigneeId) {
    where.assigneeId = assigneeId === "unassigned" ? null : assigneeId;
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { translatedSubject: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { externalId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return NextResponse.json({
    tickets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const ticket = await prisma.ticket.create({
    data: {
      subject: body.subject,
      translatedSubject: body.translatedSubject,
      detectedLanguage: body.detectedLanguage,
      status: body.status || "OPEN",
      priority: body.priority || "MEDIUM",
      category: body.category,
      tags: body.tags || [],
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      assigneeId: body.assigneeId,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(ticket, { status: 201 });
}
