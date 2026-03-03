import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { categorizeTicket } from "@/lib/services/ai";
import { revalidatePath } from "next/cache";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      messages: {
        where: { senderType: "CUSTOMER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { originalText: true },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const firstMsg = ticket.messages[0];
  if (!firstMsg) {
    return NextResponse.json(
      { error: "No customer message found" },
      { status: 400 }
    );
  }

  const result = await categorizeTicket(firstMsg.originalText);

  const updateData: Record<string, unknown> = {};
  if (result.confidence > 0.9) {
    updateData.category = result.category;
    updateData.tags = result.tags;
    updateData.priority = result.priority;
  } else if (result.confidence > 0.8) {
    updateData.category = result.category;
    updateData.tags = result.tags;
  }
  updateData.aiConfidence = result.confidence;

  if (Object.keys(updateData).length > 0) {
    await prisma.ticket.update({
      where: { id },
      data: updateData,
    });
  }

  revalidatePath("/");
  revalidatePath(`/tickets/${id}`);

  return NextResponse.json({
    ...result,
    autoApplied: result.confidence > 0.8,
  });
}
