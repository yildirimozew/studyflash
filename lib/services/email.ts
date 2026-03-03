import { Client } from "@microsoft/microsoft-graph-client";
import { prisma } from "@/lib/prisma";
import { translateInbound, categorizeTicket, smartAssign } from "./ai";

// ─── Configuration ───────────────────────────────────────────────────────────

function isGraphConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_GRAPH_CLIENT_ID &&
    process.env.MICROSOFT_GRAPH_CLIENT_SECRET &&
    process.env.MICROSOFT_GRAPH_TENANT_ID
  );
}

const COMPANY_MAILBOX = process.env.MICROSOFT_GRAPH_MAILBOX ?? "";

// ─── Graph Client ────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_GRAPH_TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_GRAPH_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_GRAPH_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Failed to get Graph access token: ${res.statusText}`);
  }

  const data = await res.json();
  return data.access_token;
}

function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  sender: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
}

export interface SyncResult {
  newTickets: number;
  newMessages: number;
  errors: string[];
}

// ─── Sender Detection ────────────────────────────────────────────────────────

function detectSenderType(
  senderEmail: string
): "CUSTOMER" | "AGENT" {
  if (!COMPANY_MAILBOX) return "CUSTOMER";
  return senderEmail.toLowerCase() === COMPANY_MAILBOX.toLowerCase()
    ? "AGENT"
    : "CUSTOMER";
}

// ─── Sync Outlook ────────────────────────────────────────────────────────────

export async function syncOutlookMessages(
  lastSyncTime?: string
): Promise<SyncResult> {
  if (!isGraphConfigured()) {
    return { newTickets: 0, newMessages: 0, errors: ["Graph API not configured - running in demo mode"] };
  }

  const accessToken = await getAccessToken();
  const client = createGraphClient(accessToken);

  let url = `/users/${COMPANY_MAILBOX}/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=id,conversationId,subject,bodyPreview,body,sender,receivedDateTime`;

  if (lastSyncTime) {
    url += `&$filter=receivedDateTime ge ${lastSyncTime}`;
  }

  const result: SyncResult = { newTickets: 0, newMessages: 0, errors: [] };

  try {
    const response = await client.api(url).get();
    const messages: GraphMessage[] = response.value || [];

    for (const msg of messages) {
      try {
        await processInboundMessage(msg);
        result.newMessages++;
      } catch (err) {
        result.errors.push(
          `Failed to process message ${msg.id}: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Graph API sync failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  return result;
}

async function processInboundMessage(msg: GraphMessage): Promise<void> {
  const existingMessage = await prisma.message.findFirst({
    where: { outlookMessageId: msg.id },
  });
  if (existingMessage) return;

  const senderEmail = msg.sender.emailAddress.address;
  const senderName = msg.sender.emailAddress.name;
  const senderType = detectSenderType(senderEmail);
  const bodyText = stripHtml(msg.body.content);

  let ticket = await prisma.ticket.findFirst({
    where: { outlookConversationId: msg.conversationId },
  });

  if (!ticket) {
    if (senderType === "AGENT") return;

    const translation = await translateInbound(bodyText);
    const categorization = await categorizeTicket(bodyText);

    const agents = await prisma.user.findMany({
      where: { role: "AGENT" },
      select: { id: true, email: true, name: true, specializations: true },
    });

    const assignment = await smartAssign({
      category: categorization.category,
      priority: categorization.priority,
      ticketBody: bodyText,
      team: agents.map((a) => ({
        email: a.email,
        name: a.name ?? a.email,
        specializations: (a.specializations as string[]) ?? [],
      })),
    });

    const assignee = agents.find((a) => a.email === assignment.suggestedAssigneeEmail) ?? null;

    ticket = await prisma.ticket.create({
      data: {
        subject: msg.subject || deriveSubjectFromBody(bodyText),
        translatedSubject: msg.subject || translation.englishText.substring(0, 100),
        detectedLanguage: translation.detectedLanguage,
        status: "OPEN",
        priority: categorization.priority,
        category: categorization.category,
        tags: categorization.tags,
        customerEmail: senderEmail,
        customerName: senderName,
        outlookConversationId: msg.conversationId,
        assigneeId:
          categorization.confidence > 0.8 ? (assignee?.id ?? null) : null,
        aiConfidence: categorization.confidence,
      },
    });
  }

  const translation =
    senderType === "CUSTOMER"
      ? await translateInbound(bodyText)
      : { englishText: bodyText, detectedLanguage: "en" };

  await prisma.message.create({
    data: {
      ticketId: ticket.id,
      originalText: bodyText,
      englishText: translation.englishText,
      originalLanguage: translation.detectedLanguage,
      senderType,
      senderEmail,
      senderName,
      outlookMessageId: msg.id,
    },
  });
}

// ─── Send Reply ──────────────────────────────────────────────────────────────

export async function sendReplyViaOutlook(params: {
  outlookMessageId: string;
  replyBody: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isGraphConfigured()) {
    console.log("[Demo Mode] Would send reply via Outlook:", params.replyBody.substring(0, 100));
    return { success: true };
  }

  try {
    const accessToken = await getAccessToken();
    const client = createGraphClient(accessToken);

    await client
      .api(`/users/${COMPANY_MAILBOX}/messages/${params.outlookMessageId}/reply`)
      .post({
        message: {
          body: {
            contentType: "Text",
            content: params.replyBody,
          },
        },
      });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown Graph API error",
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function deriveSubjectFromBody(body: string): string {
  const firstLine = body.split("\n")[0].trim();
  if (firstLine.length <= 80) return firstLine;
  return firstLine.substring(0, 77) + "...";
}
