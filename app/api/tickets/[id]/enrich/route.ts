import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEnrichmentData } from "@/lib/services/enrichment";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, customerEmail: true },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const enrichment = await getEnrichmentData(ticket.customerEmail, ticket.id);

  await prisma.ticket.update({
    where: { id },
    data: {
      sentryData: JSON.parse(JSON.stringify(enrichment.sentryErrors)),
      posthogData: JSON.parse(JSON.stringify(enrichment.posthogRecordings)),
      userData: JSON.parse(JSON.stringify(enrichment.userData)),
    },
  });

  revalidatePath(`/tickets/${id}`);
  return NextResponse.json(enrichment);
}
