import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TicketConversation } from "@/components/tickets/ticket-conversation";
import { TicketSidebar } from "@/components/tickets/ticket-sidebar";
import { TicketAiDraft } from "@/components/tickets/ticket-ai-draft";
import { TicketEnrichment } from "@/components/tickets/ticket-enrichment";
import { TicketComments } from "@/components/tickets/ticket-comments";
import { TicketSubjectHeader } from "@/components/tickets/ticket-subject-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();

  const [ticket, users] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
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
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Resolve the current user's DB id from the session email
  const currentUser = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
    : null;
  const currentUserId = currentUser?.id ?? users[0]?.id ?? "";

  if (!ticket) notFound();

  const serializedMessages = ticket.messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }));

  const serializedComments = ticket.comments.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  const ticketMeta = {
    id: ticket.id,
    externalId: ticket.externalId,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    tags: ticket.tags,
    detectedLanguage: ticket.detectedLanguage,
    customerEmail: ticket.customerEmail,
    customerName: ticket.customerName,
    assigneeId: ticket.assigneeId,
    createdAt: ticket.createdAt.toISOString(),
  };

  const sentryData = ticket.sentryData as Record<string, unknown>[] | null;
  const posthogData = ticket.posthogData as Record<string, unknown>[] | null;
  const userData = ticket.userData as Record<string, unknown> | null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Link href="/tickets">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <TicketSubjectHeader
          subject={ticket.subject}
          translatedSubject={ticket.translatedSubject}
          externalId={ticket.externalId}
          detectedLanguage={ticket.detectedLanguage}
          status={ticket.status}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: conversation + comments */}
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <Tabs defaultValue="conversation" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="mx-4 mt-3 w-fit">
              <TabsTrigger value="conversation">
                Conversation ({ticket.messages.length})
              </TabsTrigger>
              <TabsTrigger value="notes">
                Internal Notes ({ticket.comments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conversation" className="flex-1 overflow-hidden mt-0">
              <TicketConversation
                ticketId={ticket.id}
                messages={serializedMessages}
                detectedLanguage={ticket.detectedLanguage}
                aiDraft={ticket.aiDraftResponse}
              />
            </TabsContent>

            <TabsContent value="notes" className="flex-1 overflow-auto mt-0">
              <TicketComments
                ticketId={ticket.id}
                comments={serializedComments}
                currentUserId={currentUserId}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: metadata + enrichment */}
        <div className="w-80 overflow-auto p-4 space-y-4">
          <TicketSidebar ticket={ticketMeta} users={users} />

          <TicketAiDraft
            ticketId={ticket.id}
            draft={ticket.aiDraftResponse}
            draftEnglish={ticket.aiDraftEnglish}
            confidence={ticket.aiConfidence}
          />

          <TicketEnrichment
            ticketId={ticket.id}
            sentryData={sentryData as never}
            posthogData={posthogData as never}
            userData={userData as never}
          />
        </div>
      </div>
    </div>
  );
}
