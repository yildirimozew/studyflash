"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

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

export function MessageBubble({ message }: { message: Message }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const isAgent = message.senderType === "AGENT";
  const isSystem = message.senderType === "SYSTEM";

  const displayText = showOriginal
    ? message.originalText
    : message.englishText || message.originalText;

  const hasTranslation =
    message.englishText &&
    message.englishText !== message.originalText &&
    message.senderType === "CUSTOMER";

  const senderName =
    message.user?.name || message.senderName || (isAgent ? "Agent" : "Customer");
  const initials = senderName.charAt(0).toUpperCase();

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.originalText}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isAgent ? "flex-row-reverse" : ""}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={`text-xs ${isAgent ? "bg-primary/10" : "bg-muted"}`}>
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className={`max-w-[75%] space-y-1 ${isAgent ? "items-end" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{senderName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(message.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          {message.originalLanguage && message.originalLanguage !== "en" && (
            <span className="text-xs text-muted-foreground">
              ({message.originalLanguage.toUpperCase()})
            </span>
          )}
        </div>

        <div
          className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
            isAgent
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          <p className="whitespace-pre-wrap">{displayText}</p>
        </div>

        {isAgent && message.outboundTranslation && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Sent as translated
            </summary>
            <p className="mt-1 rounded bg-muted p-2 whitespace-pre-wrap">
              {message.outboundTranslation}
            </p>
          </details>
        )}

        {hasTranslation && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setShowOriginal(!showOriginal)}
          >
            <Languages className="h-3 w-3 mr-1" />
            {showOriginal ? "Show English" : "Show original"}
          </Button>
        )}
      </div>
    </div>
  );
}
