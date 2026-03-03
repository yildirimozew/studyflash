import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const comments = await prisma.comment.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (!body.body || !body.userId) {
    return NextResponse.json(
      { error: "body and userId are required" },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.create({
    data: {
      ticketId: id,
      userId: body.userId,
      body: body.body,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
