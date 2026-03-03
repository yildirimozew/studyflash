// Mocked enrichment service.
// Returns hardcoded data keyed by customer email to demonstrate the
// enrichment UI panels. Swapping these for real Sentry/PostHog/DB calls
// is a one-function change per data source.

export interface SentryError {
  title: string;
  count: number;
  lastSeen: string;
  level: "error" | "warning" | "info";
  url: string;
}

export interface PostHogRecording {
  id: string;
  date: string;
  duration: string;
  url: string;
}

export interface UserData {
  plan: "free" | "monthly" | "yearly";
  signupDate: string;
  lastActive: string;
  os: string;
  appVersion: string;
  totalDecks: number;
  totalCards: number;
}

export interface EnrichmentData {
  sentryErrors: SentryError[];
  posthogRecordings: PostHogRecording[];
  userData: UserData | null;
}

const MOCK_SENTRY_ERRORS: SentryError[] = [
  {
    title: "TypeError: Cannot read property 'id' of undefined",
    count: 23,
    lastSeen: "2026-02-28T14:30:00Z",
    level: "error",
    url: "https://sentry.io/organizations/studyflash/issues/MOCK-001/",
  },
  {
    title: "NetworkError: Failed to fetch /api/flashcards",
    count: 8,
    lastSeen: "2026-03-01T09:15:00Z",
    level: "warning",
    url: "https://sentry.io/organizations/studyflash/issues/MOCK-002/",
  },
  {
    title: "ChunkLoadError: Loading chunk 14 failed",
    count: 3,
    lastSeen: "2026-02-27T11:00:00Z",
    level: "error",
    url: "https://sentry.io/organizations/studyflash/issues/MOCK-003/",
  },
];

const MOCK_POSTHOG_RECORDINGS: PostHogRecording[] = [
  {
    id: "rec_001",
    date: "2026-03-01T10:30:00Z",
    duration: "4m 23s",
    url: "https://app.posthog.com/recordings/MOCK-REC-001",
  },
  {
    id: "rec_002",
    date: "2026-02-28T15:45:00Z",
    duration: "2m 11s",
    url: "https://app.posthog.com/recordings/MOCK-REC-002",
  },
  {
    id: "rec_003",
    date: "2026-02-27T08:20:00Z",
    duration: "7m 05s",
    url: "https://app.posthog.com/recordings/MOCK-REC-003",
  },
];

const MOCK_USER_DATA: UserData = {
  plan: "yearly",
  signupDate: "2025-09-15",
  lastActive: "2026-03-02T18:30:00Z",
  os: "iOS 18.3",
  appVersion: "3.2.1",
  totalDecks: 12,
  totalCards: 847,
};

const MOCK_FREE_USER: UserData = {
  plan: "free",
  signupDate: "2026-01-20",
  lastActive: "2026-03-01T12:00:00Z",
  os: "Android 15",
  appVersion: "3.1.9",
  totalDecks: 2,
  totalCards: 45,
};

export async function getEnrichmentData(
  customerEmail: string | null,
  fallbackSeed?: string
): Promise<EnrichmentData> {
  // In a real implementation, these would be parallel API calls:
  // const [sentryErrors, posthogRecordings, userData] = await Promise.all([
  //   fetchSentryErrors(customerEmail),
  //   fetchPostHogRecordings(customerEmail),
  //   fetchUserData(customerEmail),
  // ]);

  // Deterministic mock data keyed by email (or ticket ID as fallback)
  const seed = customerEmail ?? fallbackSeed ?? "default";
  const hash = simpleHash(seed);
  const hasSentryErrors = hash % 3 !== 0;
  const hasRecordings = hash % 2 === 0;
  const isPaidUser = hash % 4 !== 0;

  return {
    sentryErrors: hasSentryErrors
      ? MOCK_SENTRY_ERRORS.slice(0, 1 + (hash % 3))
      : [],
    posthogRecordings: hasRecordings
      ? MOCK_POSTHOG_RECORDINGS.slice(0, 1 + (hash % 3))
      : [],
    userData: isPaidUser ? { ...MOCK_USER_DATA } : { ...MOCK_FREE_USER },
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
