import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { translateInbound, categorizeTicket, smartAssign } from "./ai";

// ─── Configuration ───────────────────────────────────────────────────────────

const GMAIL_ADDRESS = process.env.GMAIL_ADDRESS ?? "";

function isGmailConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN &&
    GMAIL_ADDRESS
  );
}

// ─── Gmail Client ────────────────────────────────────────────────────────────

function getGmailClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SyncResult {
  newTickets: number;
  newMessages: number;
  errors: string[];
}

// ─── Sender Detection ────────────────────────────────────────────────────────

function detectSenderType(senderEmail: string): "CUSTOMER" | "AGENT" {
  if (!GMAIL_ADDRESS) return "CUSTOMER";
  return senderEmail.toLowerCase() === GMAIL_ADDRESS.toLowerCase()
    ? "AGENT"
    : "CUSTOMER";
}

// ─── Header Helpers ──────────────────────────────────────────────────────────

function getHeader(
  headers: { name?: string | null; value?: string | null }[],
  name: string
): string {
  return (
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

function decodeBody(
  payload: {
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: typeof payload[] | null;
  } | null | undefined
): string {
  if (!payload) return "";

  if (
    payload.mimeType === "text/plain" &&
    payload.body?.data
  ) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  if (payload.parts) {
    // Prefer text/plain; fall back to text/html
    const plain = payload.parts.find((p) => p?.mimeType === "text/plain");
    if (plain) return decodeBody(plain);
    const html = payload.parts.find((p) => p?.mimeType === "text/html");
    if (html) return stripHtml(decodeBody(html));
    // Recurse into multipart containers
    for (const part of payload.parts) {
      const text = decodeBody(part ?? null);
      if (text) return text;
    }
  }

  if (payload.body?.data) {
    const raw = Buffer.from(payload.body.data, "base64").toString("utf-8");
    return payload.mimeType === "text/html" ? stripHtml(raw) : raw;
  }

  return "";
}

// ─── Sync Gmail ──────────────────────────────────────────────────────────────

export async function syncGmailMessages(): Promise<SyncResult> {
  if (!isGmailConfigured()) {
    return {
      newTickets: 0,
      newMessages: 0,
      errors: ["Gmail not configured - add GMAIL_REFRESH_TOKEN and GMAIL_ADDRESS to .env"],
    };
  }

  const gmail = getGmailClient();
  const result: SyncResult = { newTickets: 0, newMessages: 0, errors: [] };

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "in:inbox",
      maxResults: 1,
    });

    const messageIds = listRes.data.messages ?? [];

    for (const { id } of messageIds) {
      if (!id) continue;
      try {
        const msgRes = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        });

        const msg = msgRes.data;
        const headers = msg.payload?.headers ?? [];
        const subject = getHeader(headers, "subject") || "(no subject)";
        const from = getHeader(headers, "from");
        const messageId = getHeader(headers, "message-id");
        const threadId = msg.threadId ?? id;

        // Parse "Name <email>" or plain email
        const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/) ??
          from.match(/^()(.+)$/);
        const senderName = fromMatch?.[1]?.trim() || from;
        const senderEmail = (fromMatch?.[2] ?? from).trim().toLowerCase();

        const bodyText = decodeBody(msg.payload);

        const outcome = await processInboundMessage({
          gmailMessageId: id,
          messageId,
          threadId,
          subject,
          senderEmail,
          senderName,
          bodyText,
        });

        if (outcome) {
          result.newMessages++;
          if (outcome === "new-ticket") result.newTickets++;
        }
      } catch (err) {
        result.errors.push(
          `Failed to process message ${id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } catch (err) {
    result.errors.push(
      `Gmail sync failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return result;
}

async function processInboundMessage(msg: {
  gmailMessageId: string;
  messageId: string;
  threadId: string;
  subject: string;
  senderEmail: string;
  senderName: string;
  bodyText: string;
}): Promise<"new-ticket" | "new-message" | false> {
  // Skip if already imported
  const existing = await prisma.message.findFirst({
    where: { gmailMessageId: msg.gmailMessageId },
  });
  if (existing) return false;

  const senderType = detectSenderType(msg.senderEmail);

  let ticket = await prisma.ticket.findFirst({
    where: { gmailThreadId: msg.threadId },
  });
  const isNewTicket = !ticket;

  if (!ticket) {
    // New thread -- only create a ticket for customer messages
    if (senderType === "AGENT") return false;

    const translation = await translateInbound(msg.bodyText);
    const categorization = await categorizeTicket(msg.bodyText);

    const agents = await prisma.user.findMany({
      where: { role: "AGENT" },
      select: { id: true, email: true, name: true, specializations: true },
    });

    const assignment = await smartAssign({
      category: categorization.category,
      priority: categorization.priority,
      ticketBody: msg.bodyText,
      team: agents.map((a) => ({
        email: a.email,
        name: a.name ?? a.email,
        specializations: (a.specializations as string[]) ?? [],
      })),
    });

    const assignee = agents.find((a) => a.email === assignment.suggestedAssigneeEmail) ?? null;

    ticket = await prisma.ticket.create({
      data: {
        subject: msg.subject,
        translatedSubject: translation.englishText.substring(0, 200),
        detectedLanguage: translation.detectedLanguage,
        status: "OPEN",
        priority: categorization.priority,
        category: categorization.category,
        tags: categorization.tags,
        customerEmail: msg.senderEmail,
        customerName: msg.senderName,
        gmailThreadId: msg.threadId,
        assigneeId: assignee?.id ?? null,
        aiConfidence: categorization.confidence,
      },
    });
  }

  const translation =
    senderType === "CUSTOMER"
      ? await translateInbound(msg.bodyText)
      : { englishText: msg.bodyText, detectedLanguage: "en" };

  await prisma.message.create({
    data: {
      ticketId: ticket.id,
      originalText: msg.bodyText,
      englishText: translation.englishText,
      originalLanguage: translation.detectedLanguage,
      senderType,
      senderEmail: msg.senderEmail,
      senderName: msg.senderName,
      gmailMessageId: msg.gmailMessageId,
    },
  });

  return isNewTicket ? "new-ticket" : "new-message";
}

// ─── Send Reply ──────────────────────────────────────────────────────────────

export async function sendReplyViaGmail(params: {
  gmailMessageId: string;
  gmailThreadId: string | null;
  toEmail: string;
  subject: string;
  replyBody: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isGmailConfigured()) {
    console.log("[Demo Mode] Would send Gmail reply:", params.replyBody.substring(0, 100));
    return { success: true };
  }

  try {
    const gmail = getGmailClient();

    // Build RFC 2822 email with thread-linking headers
    const emailLines = [
      `From: ${GMAIL_ADDRESS}`,
      `To: ${params.toEmail}`,
      `Subject: Re: ${params.subject.replace(/^Re:\s*/i, "")}`,
      `In-Reply-To: ${params.gmailMessageId}`,
      `References: ${params.gmailMessageId}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      params.replyBody,
    ];

    const raw = Buffer.from(emailLines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        ...(params.gmailThreadId ? { threadId: params.gmailThreadId } : {}),
      },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown Gmail API error",
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
