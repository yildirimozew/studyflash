import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  translateInbound,
  categorizeTicket,
  smartAssign,
} from "../lib/services/ai";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter }) as unknown as PrismaClient;

const TICKETS_DIR = path.join(__dirname, "..", "tickets");
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 5000;

const hasAI = !!process.env.GROQ_API_KEY;

const DEMO_USERS = [
  {
    email: "admin@studyflash.ch",
    name: "Sarah Admin",
    role: "ADMIN" as const,
    specializations: [] as string[],
  },
  {
    email: "agent1@studyflash.ch",
    name: "Max Billing",
    role: "AGENT" as const,
    specializations: [
      "Subscription",
      "Billing",
      "Account",
      "refund requests",
      "cancellation requests",
      "invoice disputes",
      "payment issues",
    ],
  },
  {
    email: "agent2@studyflash.ch",
    name: "Lena Tech",
    role: "AGENT" as const,
    specializations: [
      "Technical",
      "Product - Flashcards",
      "Product - Quiz",
      "Product - Podcast",
      "Product - Upload",
      "Product - Mindmap",
      "Product - Mock Exam",
      "Product - Summary",
      "General",
      "bug reports",
      "how-to questions",
      "image import",
      "OCR",
      "text extraction",
      "file upload",
      "app crashes",
      "feature requests",
      "language display issues",
    ],
  },
];

// Fallback maps used when Gemini is not configured
const CATEGORY_MAP: Record<string, string> = {
  "subscription-cancellation": "Subscription",
  "subscription-info": "Subscription",
  "refund-request": "Billing",
  "billing-invoice": "Billing",
  "flashcard-issues": "Product - Flashcards",
  "quiz-issues": "Product - Quiz",
  "podcast-issues": "Product - Podcast",
  "content-upload": "Product - Upload",
  "mindmap-issues": "Product - Mindmap",
  "mock-exam-issues": "Product - Mock Exam",
  "summary-issues": "Product - Summary",
  "account-issues": "Account",
  "technical-errors": "Technical",
  "language-issues": "Technical",
  "general-how-to": "General",
  "data-loss": "Technical",
  "misunderstanding": "General",
};

const PRIORITY_MAP: Record<string, string> = {
  "refund-request": "HIGH",
  "billing-invoice": "HIGH",
  "data-loss": "HIGH",
  "technical-errors": "MEDIUM",
  "subscription-cancellation": "MEDIUM",
  "account-issues": "MEDIUM",
};

interface ParsedTicket {
  tags: string[];
  body: string;
  externalId: string;
  customerName: string | null;
  isMobile: boolean;
}

function parseTicketFile(content: string, filename: string): ParsedTicket {
  const externalId = filename.replace(/\.txt$/, "").replace("ticket_", "");
  const separatorIndex = content.indexOf("---");
  let tags: string[] = [];
  let body = content.trim();

  if (separatorIndex !== -1) {
    const header = content.substring(0, separatorIndex);
    body = content.substring(separatorIndex + 3).trim();
    const tagsMatch = header.match(/^Tags:\s*(.+)$/m);
    if (tagsMatch) {
      tags = tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  const isMobile = body.startsWith("MOBILE:");
  if (isMobile) body = body.replace(/^MOBILE:\s*/, "");

  const customerName = extractCustomerName(body);
  return { tags, body, externalId, customerName, isMobile };
}

function extractCustomerName(body: string): string | null {
  const signoffPatterns = [
    /(?:mit freundlichen grüßen|freundliche grüsse|freundliche grüße|cordiali saluti|cordialement|best regards|kind regards),?\s*\n\s*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/im,
  ];
  for (const pattern of signoffPatterns) {
    const match = body.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function deriveSubject(body: string, isMobile: boolean): string {
  const firstLine = body.split("\n")[0].trim();
  if (isMobile && firstLine.length > 0) {
    const words = firstLine.split(/\s+/);
    if (words.length <= 8) return firstLine;
    return words.slice(0, 8).join(" ") + "...";
  }
  if (firstLine.length <= 80) return firstLine;
  return firstLine.substring(0, 77) + "...";
}

function fallbackCategory(tags: string[]): string | null {
  for (const tag of tags) {
    if (CATEGORY_MAP[tag]) return CATEGORY_MAP[tag];
  }
  return null;
}

function fallbackPriority(tags: string[]): string {
  for (const tag of tags) {
    if (PRIORITY_MAP[tag]) return PRIORITY_MAP[tag];
  }
  return "MEDIUM";
}

function fallbackLanguage(text: string): string {
  const lower = text.toLowerCase();
  const de = ["ich", "mein", "haben", "können", "bitte", "guten", "vielen", "danke", "habe", "möchte", "kündigung", "abo"];
  const fr = ["je", "mon", "bonjour", "merci", "pourquoi", "remboursement", "vous"];
  const nl = ["ik", "mijn", "hoe", "bedankt", "alvast", "abonnement", "graag"];
  const it = ["sono", "vorrei", "buongiorno", "annullamento", "abbonamento", "rimborso", "della"];
  const words = lower.split(/\s+/);
  let deCt = 0, frCt = 0, nlCt = 0, itCt = 0;
  for (const w of words) {
    if (de.includes(w)) deCt++;
    if (fr.includes(w)) frCt++;
    if (nl.includes(w)) nlCt++;
    if (it.includes(w)) itCt++;
  }
  const max = Math.max(deCt, frCt, nlCt, itCt);
  if (max === 0) return "de";
  if (max === deCt) return "de";
  if (max === frCt) return "fr";
  if (max === nlCt) return "nl";
  return "it";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 10;

  console.log("=== StudyFlash Support Platform - Seed Script ===\n");
  console.log(`Groq AI: ${hasAI ? "ENABLED (will translate + categorize via AI)" : "DISABLED (using local fallbacks)"}\n`);

  console.log("Creating demo users...");
  const users = [];
  for (const userData of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: { name: userData.name, role: userData.role, specializations: userData.specializations },
      create: userData,
    });
    users.push(user);
    console.log(`  ✓ ${user.name} (${user.role})`);
  }

  const agentUsers = users.filter((u) => u.role === "AGENT");

  const ticketFiles = fs
    .readdirSync(TICKETS_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .slice(0, limit);

  console.log(`\nProcessing ${ticketFiles.length} tickets...\n`);

  let processed = 0;
  let aiCalls = 0;

  for (let i = 0; i < ticketFiles.length; i += BATCH_SIZE) {
    const batch = ticketFiles.slice(i, i + BATCH_SIZE);

    for (const filename of batch) {
      processed++;
      const filePath = path.join(TICKETS_DIR, filename);
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = parseTicketFile(content, filename);

      const existing = await prisma.ticket.findUnique({
        where: { externalId: parsed.externalId },
      });
      if (existing) {
        console.log(`  [${processed}/${ticketFiles.length}] Skipping ${filename} (already exists)`);
        continue;
      }

      // --- AI or fallback: translate ---
      let englishText: string | null = null;
      let detectedLanguage: string;
      let translatedSubject: string | null = null;

      if (hasAI) {
        try {
          const translation = await translateInbound(parsed.body);
          englishText = translation.englishText;
          detectedLanguage = translation.detectedLanguage;
          aiCalls++;

          const subjectSource = deriveSubject(parsed.body, parsed.isMobile);
          const subjectTranslation = await translateInbound(subjectSource);
          translatedSubject = subjectTranslation.englishText;
          aiCalls++;
        } catch (err) {
          console.log(`    ⚠ Translation failed, using fallback: ${err instanceof Error ? err.message : err}`);
          detectedLanguage = fallbackLanguage(parsed.body);
        }
      } else {
        detectedLanguage = fallbackLanguage(parsed.body);
      }

      // --- AI or fallback: categorize ---
      let category: string | null;
      let priority: string;
      let aiTags: string[] = [];
      let confidence: number | null = null;

      if (hasAI) {
        try {
          const cat = await categorizeTicket(parsed.body);
          category = cat.category;
          priority = cat.priority;
          aiTags = cat.tags;
          confidence = cat.confidence;
          aiCalls++;
        } catch (err) {
          console.log(`    ⚠ Categorization failed, using fallback: ${err instanceof Error ? err.message : err}`);
          category = fallbackCategory(parsed.tags);
          priority = fallbackPriority(parsed.tags);
        }
      } else {
        category = fallbackCategory(parsed.tags);
        priority = fallbackPriority(parsed.tags);
      }

      const subject = deriveSubject(parsed.body, parsed.isMobile);

      // Use smart assign when AI is on, otherwise random
      let assignee: typeof agentUsers[number] | null = null;
      if (hasAI && agentUsers.length > 0 && category) {
        try {
          const assignment = await smartAssign({
            category,
            priority,
            ticketBody: parsed.body,
            team: agentUsers.map((a) => ({
              email: a.email,
              name: a.name,
              specializations: (a.specializations as string[]) ?? [],
            })),
          });
          assignee = agentUsers.find((u) => u.email === assignment.suggestedAssigneeEmail) ?? null;
          aiCalls++;
        } catch (err) {
          console.log(`    ⚠ Smart assign failed, using random: ${err instanceof Error ? err.message : err}`);
          assignee = agentUsers[Math.floor(Math.random() * agentUsers.length)];
        }
      } else {
        const shouldAssign = Math.random() < 0.6;
        assignee = shouldAssign ? agentUsers[Math.floor(Math.random() * agentUsers.length)] : null;
      }

      const statusOptions: Array<"OPEN" | "IN_PROGRESS" | "WAITING"> = ["OPEN", "OPEN", "OPEN", "IN_PROGRESS", "WAITING"];
      const status = assignee
        ? statusOptions[Math.floor(Math.random() * statusOptions.length)]
        : "OPEN";

      const ticketTags = hasAI
        ? aiTags
        : parsed.tags.filter((t) => t !== "ai-draft" && t !== "AI" && t !== "auto-closed" && t !== "garbage");

      const ticket = await prisma.ticket.create({
        data: {
          externalId: parsed.externalId,
          subject,
          translatedSubject: translatedSubject || (englishText ? deriveSubject(englishText, parsed.isMobile) : null),
          detectedLanguage,
          status,
          priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
          category,
          tags: ticketTags,
          customerName: parsed.customerName,
          assigneeId: assignee?.id ?? null,
          aiConfidence: confidence,
        },
      });

      await prisma.message.create({
        data: {
          ticketId: ticket.id,
          originalText: parsed.body,
          englishText: englishText,
          originalLanguage: detectedLanguage,
          senderType: "CUSTOMER",
          senderName: parsed.customerName,
        },
      });

      const langTag = detectedLanguage.toUpperCase();
      const catDisplay = category || "uncategorized";
      const assigneeDisplay = assignee ? ` → ${assignee.name}` : "";
      const confDisplay = confidence !== null ? ` (${Math.round(confidence * 100)}%)` : "";
      console.log(
        `  [${processed}/${ticketFiles.length}] ${filename} | ${catDisplay}${confDisplay} | ${langTag}${assigneeDisplay}`
      );
    }

    // Rate-limit pause between batches when using Gemini
    if (hasAI && i + BATCH_SIZE < ticketFiles.length) {
      console.log(`  ... batch done (${aiCalls} AI calls so far), pausing ${BATCH_DELAY_MS / 1000}s for rate limits ...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`\n✓ Seeded ${processed} tickets and ${DEMO_USERS.length} users.`);
  if (hasAI) console.log(`  Total Groq API calls: ${aiCalls}`);

  const stats = await prisma.ticket.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("\nTicket status breakdown:");
  for (const s of stats) {
    console.log(`  ${s.status}: ${s._count}`);
  }
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
