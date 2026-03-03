"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, RefreshCw, Languages } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function TicketAiDraft({
  ticketId,
  draft,
  draftEnglish,
  confidence,
}: {
  ticketId: string;
  draft: string | null;
  draftEnglish: string | null;
  confidence: number | null;
}) {
  const [loading, setLoading] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/ai/draft`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("AI draft generated");
      router.refresh();
    } catch {
      toast.error("Failed to generate draft");
    } finally {
      setLoading(false);
    }
  };

  const hasTranslation = draft && draftEnglish && draft !== draftEnglish;
  const displayText = showEnglish ? draftEnglish : draft;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Draft
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerate}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            {draft ? "Regenerate" : "Generate"}
          </Button>
        </div>
      </CardHeader>
      {draft && (
        <CardContent className="space-y-3">
          {hasTranslation && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Languages className="h-3 w-3" />
              <span>Drafted in customer language</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs ml-auto"
                onClick={() => setShowEnglish((v) => !v)}
              >
                {showEnglish ? "Show customer version" : "Show English"}
              </Button>
            </div>
          )}

          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {displayText}
          </p>

          {confidence !== null && (
            <div className="text-xs text-muted-foreground">
              Confidence: {Math.round(confidence * 100)}%
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
