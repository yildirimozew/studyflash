"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Video,
  User,
  ExternalLink,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SentryError {
  title: string;
  count: number;
  lastSeen: string;
  level: string;
  url: string;
}

interface PostHogRecording {
  id: string;
  date: string;
  duration: string;
  url: string;
}

interface UserData {
  plan: string;
  signupDate: string;
  lastActive: string;
  os: string;
  appVersion: string;
  totalDecks: number;
  totalCards: number;
}

export function TicketEnrichment({
  ticketId,
  sentryData,
  posthogData,
  userData,
}: {
  ticketId: string;
  sentryData: SentryError[] | null;
  posthogData: PostHogRecording[] | null;
  userData: UserData | null;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const hasData =
    (Array.isArray(sentryData) && sentryData.length > 0) ||
    (Array.isArray(posthogData) && posthogData.length > 0) ||
    userData != null;

  const handleEnrich = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/enrich`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("Enrichment data loaded");
      router.refresh();
    } catch {
      toast.error("Failed to load enrichment data");
    } finally {
      setLoading(false);
    }
  };

  if (!hasData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleEnrich}
            disabled={loading}
          >
            <Database className="h-4 w-4 mr-2" />
            {loading ? "Loading..." : "Load Enrichment Data"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sentryErrors = (sentryData || []) as SentryError[];
  const recordings = (posthogData || []) as PostHogRecording[];
  const user = userData as UserData | null;

  return (
    <div className="space-y-3">
      {user && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              User Info
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row label="Plan" value={user.plan} />
            <Row label="Signup" value={user.signupDate} />
            <Row label="Last active" value={new Date(user.lastActive).toLocaleDateString()} />
            <Row label="OS" value={user.os} />
            <Row label="App" value={`v${user.appVersion}`} />
            <Row label="Decks / Cards" value={`${user.totalDecks} / ${user.totalCards}`} />
          </CardContent>
        </Card>
      )}

      {sentryErrors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Sentry Errors ({sentryErrors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sentryErrors.map((err, i) => (
              <div key={i} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs truncate flex-1">
                    {err.title}
                  </span>
                  <a
                    href={err.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                </div>
                <div className="text-xs text-muted-foreground">
                  {err.count} events &middot; {err.level}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {recordings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4 text-blue-500" />
              PostHog Recordings ({recordings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recordings.map((rec) => (
              <a
                key={rec.id}
                href={rec.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-sm hover:bg-muted p-1.5 rounded"
              >
                <div>
                  <div className="text-xs">
                    {new Date(rec.date).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {rec.duration}
                  </div>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
