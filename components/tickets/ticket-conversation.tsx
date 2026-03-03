"use client";

import { useState } from "react";
import { MessageBubble } from "./message-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  originalText: string;
  englishText: string | null;
  outboundTranslation: string | null;
  originalLanguage: string | null;
  senderType: "CUSTOMER" | "AGENT" | "SYSTEM";
  senderName: string | null;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

export function TicketConversation({
  ticketId,
  messages,
  detectedLanguage,
  aiDraft,
}: {
  ticketId: string;
  messages: Message[];
  detectedLanguage: string | null;
  aiDraft: string | null;
}) {
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  const handleSend = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setReplyText("");
      toast.success(
        detectedLanguage && detectedLanguage !== "en"
          ? `Sent (translated to ${detectedLanguage.toUpperCase()})`
          : "Reply sent"
      );
      router.refresh();
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const handleUseDraft = () => {
    if (aiDraft) setReplyText(aiDraft);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      <div className="border-t p-4 space-y-3">
        {aiDraft && !replyText && (
          <Button variant="outline" size="sm" onClick={handleUseDraft}>
            Use AI Draft
          </Button>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder={
              detectedLanguage && detectedLanguage !== "en"
                ? `Write in English (auto-translated to ${detectedLanguage.toUpperCase()})...`
                : "Write your reply..."
            }
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
