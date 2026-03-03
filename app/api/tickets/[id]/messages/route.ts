import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { translateOutbound } from "@/lib/services/ai";
import { sendReplyViaOutlook } from "@/lib/services/email";
import { revalidatePath } from "next/cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const messages = await prisma.message.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(messages);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      messages: {
        where: { senderType: "CUSTOMER" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const agentText: string = body.text;
  const userId: string | undefined = body.userId;

  let outboundTranslation: string | null = null;
  if (ticket.detectedLanguage && ticket.detectedLanguage !== "en") {
    const result = await translateOutbound(agentText, ticket.detectedLanguage);
    outboundTranslation = result.translatedText;
  }

  const lastCustomerMsg = ticket.messages[0];
  if (lastCustomerMsg?.outlookMessageId) {
    const textToSend = outboundTranslation || agentText;
    await sendReplyViaOutlook({
      outlookMessageId: lastCustomerMsg.outlookMessageId,
      replyBody: textToSend,
    });
  }

  const message = await prisma.message.create({
    data: {
      ticketId: id,
      originalText: agentText,
      englishText: agentText,
      outboundTranslation,
      originalLanguage: "en",
      senderType: "AGENT",
      userId,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  if (ticket.status === "OPEN") {
    await prisma.ticket.update({
      where: { id },
      data: { status: "IN_PROGRESS" },
    });
  }

  revalidatePath("/");
  revalidatePath(`/tickets/${id}`);

  return NextResponse.json(message, { status: 201 });
}
