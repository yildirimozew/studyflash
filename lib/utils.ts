import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ParsedTicket {
  tags: string[];
  body: string;
  externalId: string;
  customerName: string | null;
  customerEmail: string | null;
  isMobile: boolean;
}

export function parseTicketFile(content: string, filename: string): ParsedTicket {
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
  if (isMobile) {
    body = body.replace(/^MOBILE:\s*/, "");
  }

  const customerName = extractCustomerName(body);
  const customerEmail = extractEmail(body);

  return { tags, body, externalId, customerName, customerEmail, isMobile };
}

function extractCustomerName(body: string): string | null {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 6); i--) {
    const line = lines[i];
    if (line === "[EMAIL]" || line.startsWith(">") || line.startsWith("http")) continue;
    if (/^(mit freundlichen grüßen|freundliche grüsse|freundliche grüße|cordiali saluti|cordialement|mvg|met vriendelijke groet|best regards|kind regards|mfg|lg|vg)/i.test(line)) continue;

    const nextLine = lines[i + 1];
    if (nextLine && /^(mit freundlichen grüßen|freundliche grüsse|freundliche grüße|cordiali saluti|cordialement|mvg|met vriendelijke groet|best regards|kind regards|mfg|lg|vg)/i.test(lines[i])) {
      if (nextLine && !nextLine.startsWith("[") && !nextLine.startsWith("http") && nextLine.length < 50 && /^[A-ZÄÖÜ]/.test(nextLine)) {
        return nextLine;
      }
    }

    if (/^(mit freundlichen grüßen|freundliche grüsse|freundliche grüße|cordiali saluti|cordialement|best regards|kind regards)/i.test(lines[i])) {
      const nameCandidate = lines[i + 1];
      if (nameCandidate && !nameCandidate.startsWith("[") && !nameCandidate.startsWith("http") && nameCandidate.length < 50 && /^[A-ZÄÖÜ]/.test(nameCandidate)) {
        return nameCandidate;
      }
    }
  }

  const signoffPatterns = [
    /(?:mit freundlichen grüßen|freundliche grüsse|freundliche grüße|cordiali saluti|cordialement|best regards|kind regards|mvg|mfg|lg|vg),?\s*\n\s*([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/im,
  ];

  for (const pattern of signoffPatterns) {
    const match = body.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

function extractEmail(body: string): string | null {
  if (body.includes("[EMAIL]")) return null;
  const emailMatch = body.match(/[\w.-]+@[\w.-]+\.\w+/);
  return emailMatch ? emailMatch[0] : null;
}

export function deriveSubject(body: string, isMobile: boolean): string {
  const firstLine = body.split("\n")[0].trim();

  if (isMobile && firstLine.length > 0) {
    const words = firstLine.split(/\s+/);
    if (words.length <= 8) return firstLine;
    return words.slice(0, 8).join(" ") + "...";
  }

  if (firstLine.length <= 80) return firstLine;
  return firstLine.substring(0, 77) + "...";
}
