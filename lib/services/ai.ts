import Groq from "groq-sdk";

const MODEL = "llama-3.1-8b-instant";

function getClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

async function chatJSON<T>(systemPrompt: string, userPrompt: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) return null;
  return JSON.parse(text) as T;
}

// ─── Categorize ──────────────────────────────────────────────────────────────

export interface CategorizeResult {
  category: string;
  tags: string[];
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  confidence: number;
}

const CATEGORIES = [
  "Subscription",
  "Billing",
  "Product - Flashcards",
  "Product - Quiz",
  "Product - Podcast",
  "Product - Upload",
  "Product - Mindmap",
  "Product - Mock Exam",
  "Product - Summary",
  "Account",
  "Technical",
  "General",
];

export async function categorizeTicket(
  messageBody: string
): Promise<CategorizeResult> {
  const systemPrompt = `You are a support ticket classifier for StudyFlash, an education app that helps students create flashcards, quizzes, summaries, mindmaps, and podcasts from their study materials.

Respond with a JSON object containing:
- "category": one of [${CATEGORIES.map((c) => `"${c}"`).join(", ")}]
- "tags": an array of relevant short tags (e.g. ["refund", "urgent"])
- "priority": one of ["LOW", "MEDIUM", "HIGH", "URGENT"]
- "confidence": a number between 0 and 1 representing your confidence`;

  const userPrompt = `Classify this support ticket. The ticket may be in German, French, Dutch, or Italian.\n\nTicket:\n${messageBody}`;

  try {
    const parsed = await chatJSON<Record<string, unknown>>(systemPrompt, userPrompt);
    if (!parsed) return { category: "General", tags: [], priority: "MEDIUM", confidence: 0 };

    return {
      category: CATEGORIES.includes(parsed.category as string)
        ? (parsed.category as string)
        : "General",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(parsed.priority as string)
        ? (parsed.priority as CategorizeResult["priority"])
        : "MEDIUM",
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : 0.5,
    };
  } catch {
    return { category: "General", tags: [], priority: "MEDIUM", confidence: 0 };
  }
}

// ─── Translate Inbound ───────────────────────────────────────────────────────

export interface TranslateInboundResult {
  englishText: string;
  detectedLanguage: string;
}

export async function translateInbound(
  originalText: string
): Promise<TranslateInboundResult> {
  const systemPrompt = `You are a translation assistant. Translate support ticket messages to English and detect the source language.

Respond with a JSON object containing:
- "englishText": the English translation of the message (if already English, return as-is)
- "detectedLanguage": the ISO 639-1 code of the original language (e.g. "de", "fr", "nl", "it", "en")`;

  const userPrompt = `Translate this support ticket message to English:\n\n${originalText}`;

  try {
    const parsed = await chatJSON<Record<string, unknown>>(systemPrompt, userPrompt);
    if (!parsed) return { englishText: originalText, detectedLanguage: "unknown" };

    return {
      englishText: (parsed.englishText as string) || originalText,
      detectedLanguage: (parsed.detectedLanguage as string) || "unknown",
    };
  } catch {
    return { englishText: originalText, detectedLanguage: "unknown" };
  }
}

// ─── Translate Outbound ──────────────────────────────────────────────────────

export interface TranslateOutboundResult {
  translatedText: string;
}

const LANG_NAMES: Record<string, string> = {
  de: "German",
  fr: "French",
  nl: "Dutch",
  it: "Italian",
};

export async function translateOutbound(
  englishText: string,
  targetLanguage: string
): Promise<TranslateOutboundResult> {
  if (!getClient() || targetLanguage === "en") {
    return { translatedText: englishText };
  }

  const langName = LANG_NAMES[targetLanguage] || targetLanguage;

  const systemPrompt = `You are a translation assistant. Translate customer support replies from English to ${langName}. Keep the tone professional and friendly. Preserve any technical terms.

Respond with a JSON object containing:
- "translatedText": the translated text`;

  const userPrompt = `Translate this support reply to ${langName}:\n\n${englishText}`;

  try {
    const parsed = await chatJSON<Record<string, unknown>>(systemPrompt, userPrompt);
    if (!parsed) return { translatedText: englishText };

    return { translatedText: (parsed.translatedText as string) || englishText };
  } catch {
    return { translatedText: englishText };
  }
}

// ─── Draft Response ──────────────────────────────────────────────────────────

export interface DraftResponseResult {
  draftResponse: string;
  draftEnglish: string;
  confidence: number;
}

export async function draftResponse(params: {
  ticketBody: string;
  category: string | null;
  customerName: string | null;
  detectedLanguage: string | null;
  conversationHistory?: string[];
}): Promise<DraftResponseResult> {
  const replyLang =
    LANG_NAMES[params.detectedLanguage ?? "en"] ||
    "the same language as the customer";

  const historyContext =
    params.conversationHistory && params.conversationHistory.length > 0
      ? `\nPrevious messages in thread:\n${params.conversationHistory.join("\n---\n")}\n`
      : "";

  const systemPrompt = `You are a friendly, professional support agent for StudyFlash, an education app.

Guidelines:
- Be empathetic and professional
- If it's a cancellation/refund request, acknowledge their concern and explain you'll look into it
- If it's a technical issue, ask for more details or provide a workaround
- If it's a how-to question, provide clear step-by-step instructions
- Keep it concise (2-4 sentences for simple queries, more for complex ones)
- Sign off as "StudyFlash Support Team"

Respond with a JSON object containing:
- "draftResponse": the reply written in ${replyLang} (this will be sent to the customer)
- "draftEnglish": the same reply translated to English (so the agent can review it)
- "confidence": a number between 0 and 1 representing your confidence in the draft

If ${replyLang} is English, set "draftEnglish" to the same text as "draftResponse".`;

  const userPrompt = `Draft a reply to this support ticket.
${params.category ? `Category: ${params.category}` : ""}
${params.customerName ? `Customer name: ${params.customerName}` : ""}
${historyContext}
Customer message:
${params.ticketBody}`;

  try {
    const parsed = await chatJSON<Record<string, unknown>>(systemPrompt, userPrompt);
    if (!parsed) return { draftResponse: "", draftEnglish: "", confidence: 0 };

    const draft = (parsed.draftResponse as string) || "";
    return {
      draftResponse: draft,
      draftEnglish: (parsed.draftEnglish as string) || draft,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : 0.5,
    };
  } catch {
    return { draftResponse: "", draftEnglish: "", confidence: 0 };
  }
}

// ─── Smart Assign ────────────────────────────────────────────────────────────

export interface TeamMember {
  email: string;
  name: string;
  specializations: string[];
}

export interface SmartAssignResult {
  suggestedAssigneeEmail: string;
  reason: string;
}

export async function smartAssign(params: {
  category: string | null;
  priority: string;
  ticketBody: string;
  team: TeamMember[];
}): Promise<SmartAssignResult> {
  const { team } = params;
  if (team.length === 0) return { suggestedAssigneeEmail: "", reason: "No agents available" };

  const validEmails = team.map((m) => m.email);

  // Build a numbered agent list dynamically from whoever is passed in
  const agentList = team
    .map(
      (m, i) =>
        `${i + 1}. ${m.name} <${m.email}>\n   Handles: ${m.specializations.join(", ")}`
    )
    .join("\n\n");

  const systemPrompt = `You are a support ticket router. Your job is to assign an incoming ticket to the most suitable agent based on what they handle.

Available agents:
${agentList}

Rules:
- Read the ticket carefully and match its topic to the agent whose "Handles" list is the best fit.
- Prefer specificity: if one agent lists the exact topic and another lists only a broad category, choose the specific match.
- Only output a valid agent email from the list above.

Respond with a JSON object:
- "suggestedAssigneeEmail": the email of the chosen agent (must be one of: ${validEmails.map((e) => `"${e}"`).join(", ")})
- "reason": one concise sentence explaining why this agent was chosen`;

  const userPrompt = `Assign the following support ticket to the best agent.

Category: ${params.category || "Unknown"}
Priority: ${params.priority}
Ticket content:
${params.ticketBody.substring(0, 400)}`;

  try {
    const parsed = await chatJSON<Record<string, unknown>>(systemPrompt, userPrompt);
    if (!parsed) return fallbackAssign(team, params.category);

    const email = parsed.suggestedAssigneeEmail as string;
    if (validEmails.includes(email)) {
      return {
        suggestedAssigneeEmail: email,
        reason: (parsed.reason as string) || "Best match based on specialization",
      };
    }
    return fallbackAssign(team, params.category);
  } catch {
    return fallbackAssign(team, params.category);
  }
}

function fallbackAssign(team: TeamMember[], category: string | null): SmartAssignResult {
  // Pick the agent whose specializations overlap the most with the category
  if (category) {
    const scored = team.map((m) => ({
      email: m.email,
      score: m.specializations.filter(
        (s) => category.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(category.toLowerCase())
      ).length,
    }));
    const best = scored.sort((a, b) => b.score - a.score)[0];
    if (best && best.score > 0) {
      return { suggestedAssigneeEmail: best.email, reason: "Matched by specialization (fallback)" };
    }
  }
  return {
    suggestedAssigneeEmail: team[0].email,
    reason: "Default assignment (fallback)",
  };
}
