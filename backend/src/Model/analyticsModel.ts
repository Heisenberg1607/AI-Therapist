import { prisma } from "../prisma/prismaClient";

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";

const RANGE_DAYS: Record<Exclude<AnalyticsRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function cutoffFor(range: AnalyticsRange): Date | null {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - RANGE_DAYS[range]);
  return d;
}

function pacificHour(d: Date): number {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(d),
  );
  return hour === 24 ? 0 : hour;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

export interface UserAnalytics {
  range: AnalyticsRange;
  totalSessions: number;
  totalDurationSec: number;
  avgDurationSec: number;
  sessionsThisWeek: number;
  currentStreakDays: number;
  daysSinceLast: number | null;
  crisisCount: number;
  // Transcript-derived moods (one of the 6 MOOD_LABELS). moodStart/moodEnd are the
  // client's mood at the start/end of each session; the client maps each to a score
  // via moodToScore to chart the start→end trend.
  moodTimeline: {
    date: string;
    moodStart: string | null;
    moodEnd: string | null;
  }[];
  // Distribution of how sessions END (moodEnd), most frequent first.
  moodDistribution: { mood: string; count: number }[];
  topicDistribution: { topic: string; count: number }[];
  sessionsByDay: { date: string; count: number }[];
  timeOfDay: { hour: number; count: number }[]; // hour bucket (UTC), 0–23
  messages: { total: number; user: number; ai: number; avgPerSession: number };
}

// Count distinct, non-empty string values, sorted by frequency (desc).
function countBy<T>(items: T[], pick: (t: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const it of items) {
    const v = (pick(it) ?? "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

// Consecutive calendar days (UTC) with at least one session, ending at the most
// recent session day. 0 when there are no sessions.
function currentStreakDays(days: Set<string>): number {
  if (days.size === 0) return 0;
  const sorted = [...days].sort().reverse(); // newest first
  let streak = 1;
  let prev = new Date(sorted[0] + "T00:00:00Z").getTime();
  for (let i = 1; i < sorted.length; i++) {
    const cur = new Date(sorted[i] + "T00:00:00Z").getTime();
    if (prev - cur === DAY_MS) {
      streak++;
      prev = cur;
    } else {
      break;
    }
  }
  return streak;
}

// All user-specific analytics for a time range, derived from Session + Message.
export const getUserAnalytics = async (
  userId: string,
  range: AnalyticsRange = "30d",
): Promise<UserAnalytics> => {
  const cutoff = cutoffFor(range);
  const sessionWhere = {
    userId,
    ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
  };

  const sessions = await prisma.session.findMany({
    where: sessionWhere,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      mood: true,
      moodEnd: true,
      topic: true,
      durationSec: true,
      crisisFlag: true,
    },
  });

  // USER vs AI message counts across the same window (relation filter).
  const grouped = await prisma.message.groupBy({
    by: ["sender"],
    where: { session: sessionWhere },
    _count: { _all: true },
  });
  const senderCount = (s: string) =>
    grouped.find((g) => g.sender === s)?._count._all ?? 0;
  const userMsgs = senderCount("USER");
  const aiMsgs = senderCount("AI");
  const totalMsgs = userMsgs + aiMsgs;

  const withDuration = sessions.filter((s) => s.durationSec != null);
  const totalDurationSec = withDuration.reduce(
    (acc, s) => acc + (s.durationSec ?? 0),
    0,
  );

  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;
  const sessionsThisWeek = sessions.filter(
    (s) => s.createdAt.getTime() >= weekAgo,
  ).length;

  const last = sessions.length ? sessions[sessions.length - 1] : null;
  const daysSinceLast = last
    ? Math.floor((now - last.createdAt.getTime()) / DAY_MS)
    : null;

  // Per-day and per-hour buckets.
  const byDay = new Map<string, number>();
  const byHour = new Map<number, number>();
  const dayKeys = new Set<string>();
  for (const s of sessions) {
    const k = dayKey(s.createdAt);
    dayKeys.add(k);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
    const h = pacificHour(s.createdAt);
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }

  return {
    range,
    totalSessions: sessions.length,
    totalDurationSec,
    avgDurationSec: withDuration.length
      ? Math.round(totalDurationSec / withDuration.length)
      : 0,
    sessionsThisWeek,
    currentStreakDays: currentStreakDays(dayKeys),
    daysSinceLast,
    crisisCount: sessions.filter((s) => s.crisisFlag).length,
    moodTimeline: sessions
      .filter((s) => (s.mood ?? "").trim() || (s.moodEnd ?? "").trim())
      .map((s) => ({
        date: s.createdAt.toISOString(),
        moodStart: (s.mood ?? "").trim() || null,
        moodEnd: (s.moodEnd ?? "").trim() || null,
      })),
    // Distribution keys off how sessions END (moodEnd).
    moodDistribution: countBy(sessions, (s) => s.moodEnd).map(
      ({ key, count }) => ({ mood: key, count }),
    ),
    topicDistribution: countBy(sessions, (s) => s.topic).map(
      ({ key, count }) => ({ topic: key, count }),
    ),
    sessionsByDay: [...byDay.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    timeOfDay: [...byHour.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour),
    messages: {
      total: totalMsgs,
      user: userMsgs,
      ai: aiMsgs,
      avgPerSession: sessions.length
        ? Math.round((totalMsgs / sessions.length) * 10) / 10
        : 0,
    },
  };
};
