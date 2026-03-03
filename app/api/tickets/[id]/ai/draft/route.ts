import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { draftResponse } from "@/lib/services/ai";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { originalText: true, englishText: true, senderType: true },
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const firstCustomerMsg = ticket.messages.find(
    (m) => m.senderType === "CUSTOMER"
  );

  const conversationHistory = ticket.messages.map(
    (m) => `[${m.senderType}]: ${m.englishText || m.originalText}`
  );

  const result = await draftResponse({
    ticketBody: firstCustomerMsg?.originalText || ticket.subject,
    category: ticket.category,
    customerName: ticket.customerName,
    detectedLanguage: ticket.detectedLanguage,
    conversationHistory,
  });

  await prisma.ticket.update({
    where: { id },
    data: {
      aiDraftResponse: result.draftResponse,
      aiDraftEnglish: result.draftEnglish,
      aiConfidence: result.confidence,
    },
  });

  return NextResponse.json({
    draftResponse: result.draftResponse,
    draftEnglish: result.draftEnglish,
    confidence: result.confidence,
  });
}
