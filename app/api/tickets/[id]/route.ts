import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const allowedFields = [
    "status",
    "priority",
    "category",
    "assigneeId",
    "tags",
    "aiDraftResponse",
    "aiConfidence",
  ];

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  revalidatePath("/");
  revalidatePath(`/tickets/${id}`);

  return NextResponse.json(ticket);
}
