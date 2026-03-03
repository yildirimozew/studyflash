"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
}

export function TicketComments({
  ticketId,
  comments,
  currentUserId,
}: {
  ticketId: string;
  comments: Comment[];
  currentUserId: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, userId: currentUserId }),
      });
      if (!res.ok) throw new Error();
      setText("");
      toast.success("Internal note added");
      router.refresh();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No internal notes yet.
        </p>
      )}
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-3">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-xs">
              {comment.user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{comment.user.name}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(comment.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap">{comment.body}</p>
          </div>
        </div>
      ))}

      <div className="flex gap-2 pt-2 border-t">
        <Textarea
          placeholder="Add an internal note..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!text.trim() || sending}
          className="self-end"
        >
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
