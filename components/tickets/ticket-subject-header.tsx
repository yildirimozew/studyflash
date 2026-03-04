"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  subject: string;
  translatedSubject: string | null;
  externalId: string | null;
  detectedLanguage: string | null;
  status: string;
}

export function TicketSubjectHeader({
  subject,
  translatedSubject,
  externalId,
  detectedLanguage,
  status,
}: Props) {
  const [showOriginal, setShowOriginal] = useState(false);

  const hasTranslation =
    translatedSubject && translatedSubject !== subject;

  const displaySubject =
    hasTranslation && showOriginal ? subject : (translatedSubject || subject);

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold truncate">{displaySubject}</h1>
        {hasTranslation && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs shrink-0 text-muted-foreground"
            onClick={() => setShowOriginal((v) => !v)}
          >
            <Languages className="h-3 w-3 mr-1" />
            {showOriginal ? "Show English" : `Show ${detectedLanguage?.toUpperCase() ?? "original"}`}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        #{externalId || "—"} &middot;{" "}
        {detectedLanguage?.toUpperCase()} &middot;{" "}
        {status.replace("_", " ")}
      </p>
    </div>
  );
}
