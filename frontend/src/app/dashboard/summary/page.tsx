"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calendar, Clock, Heart, MessageCircle, Sparkles } from "lucide-react";
import { ProtectedRoute } from "../../Components/ProtectedRoute";
import {
  getSessions,
  moodToScore,
  SCORE_LABELS,
  type SessionData,
} from "@/lib/sessionStorage";
import { getSessionsApi, type DbSession } from "../../lib/api";

const STARLIGHT = "hsl(72, 100%, 70%)";
const NEBULA = "hsl(220, 80%, 65%)";
const NEBULA_FADED = "hsla(220, 80%, 65%, 0.4)";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best || "—";
}

const cardClass =
  "rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 md:p-8";
const labelClass =
  "text-[10px] uppercase tracking-[0.3em] text-white/40 font-medium";

function SummaryDashboard() {
  const [sessions, setSessions] = useState<SessionData[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const mapDb = (s: DbSession): SessionData => ({
      id: s.id,
      date: s.createdAt,
      duration: s.durationSec ?? 0,
      mood: s.mood ?? "",
      moodEnd: s.moodEnd ?? "",
      topic: s.topic ?? "",
      summary: s.summary ?? "",
      transcript: [],
    });
    (async () => {
      // Prefer the DB (persisted per user); fall back to local copies.
      const db = await getSessionsApi();
      if (cancelled) return;
      if (db.length > 0) {
        // Keep only sessions that actually have a recorded summary/mood.
        const usable = db.filter(
          (s) => s.summary || s.mood || s.moodEnd || s.durationSec,
        );
        setSessions((usable.length ? usable : db).map(mapDb));
      } else {
        setSessions(getSessions());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Oldest → newest for the timeline.
  const ordered = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [sessions]);

  const latest = ordered.length ? ordered[ordered.length - 1] : null;

  const chartData = useMemo(
    () =>
      ordered.map((s, i) => ({
        date: formatDate(s.date),
        start: s.mood ? moodToScore(s.mood) : null,
        end: s.moodEnd ? moodToScore(s.moodEnd) : null,
        startMood: s.mood || "Unknown",
        endMood: s.moodEnd || "Unknown",
        isLatest: i === ordered.length - 1,
      })),
    [ordered],
  );

  const insights = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = sessions.filter(
      (s) => new Date(s.date).getTime() >= weekAgo,
    ).length;
    return {
      total: sessions.length,
      // How sessions most often END.
      commonMood: mode(sessions.map((s) => s.moodEnd ?? "")),
      commonTopic: mode(sessions.map((s) => s.topic)),
      thisWeek,
    };
  }, [sessions]);

  // Loading (pre-hydration) state.
  if (sessions === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/40 text-sm">
        Loading your sessions…
      </div>
    );
  }

  // Empty state.
  if (sessions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <Sparkles className="w-8 h-8 text-starlight/70 mb-6" />
        <h1
          className="text-2xl md:text-3xl text-white/90 italic mb-3"
          style={{ fontFamily: "Georgia, serif" }}
        >
          No sessions yet
        </h1>
        <p className="text-white/50 max-w-sm mb-8">
          Once you finish a conversation, your reflections and mood over time
          will appear here.
        </p>
        <Link
          href="/chat"
          className="px-8 h-12 inline-flex items-center gap-2 rounded-full text-sm uppercase tracking-[0.2em] text-black font-semibold hover:scale-[1.02] transition-transform"
          style={{ background: STARLIGHT, boxShadow: "0 0 40px hsla(72,100%,70%,0.3)" }}
        >
          Begin a session
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white px-6 md:px-12 py-12"
      style={{ animation: "fade-in 0.6s ease-out" }}
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Heading */}
        <div>
          <p className={labelClass}>Your space</p>
          <h1
            className="text-3xl md:text-4xl text-white/90 italic mt-2"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Session reflections
          </h1>
        </div>

        {/* Section 1 — Latest session summary */}
        {latest && (
          <section
            className={cardClass}
            style={{ animation: "fade-in 0.6s ease-out" }}
          >
            <p className={labelClass}>Most recent session</p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-6">
              <Stat icon={<Calendar className="w-4 h-4" />} label="Date" value={formatDate(latest.date)} />
              <Stat icon={<Clock className="w-4 h-4" />} label="Duration" value={formatDuration(latest.duration)} />
              <Stat icon={<MessageCircle className="w-4 h-4" />} label="Topic" value={latest.topic || "—"} />
              <Stat icon={<Heart className="w-4 h-4" />} label="Mood (start → end)" value={`${latest.mood || "—"} → ${latest.moodEnd || "—"}`} />
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className={labelClass}>What you explored</p>
              <p
                className="mt-3 text-lg md:text-xl text-white/80 leading-relaxed italic"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {latest.summary || "A summary isn't available for this session."}
              </p>
            </div>
          </section>
        )}

        {/* Section 2 — Mood timeline */}
        <section className={cardClass} style={{ animation: "fade-in 0.7s ease-out" }}>
          <p className={labelClass}>Mood over time</p>
          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[1, 6]}
                  ticks={[1, 2, 3, 4, 5, 6]}
                  width={92}
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                  tickFormatter={(v: number) => SCORE_LABELS[v] ?? ""}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(240, 20%, 8%)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                  formatter={(_value, name, item) => {
                    const p = item?.payload as {
                      startMood?: string;
                      endMood?: string;
                    };
                    return name === "Start"
                      ? [p?.startMood ?? "—", "Start"]
                      : [p?.endMood ?? "—", "End"];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="start"
                  name="Start"
                  stroke={NEBULA_FADED}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: NEBULA_FADED }}
                  connectNulls
                  isAnimationActive
                />
                <Line
                  type="monotone"
                  dataKey="end"
                  name="End"
                  stroke={NEBULA}
                  strokeWidth={2}
                  connectNulls
                  dot={(props) => {
                    const { cx, cy, index, payload } = props as {
                      cx: number;
                      cy: number;
                      index: number;
                      payload: { isLatest: boolean };
                    };
                    const latestDot = payload.isLatest;
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={latestDot ? 7 : 4}
                        fill={latestDot ? STARLIGHT : NEBULA}
                        stroke={latestDot ? STARLIGHT : "transparent"}
                        strokeOpacity={0.4}
                        strokeWidth={latestDot ? 6 : 0}
                      />
                    );
                  }}
                  activeDot={{ r: 6, fill: STARLIGHT }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-white/30">
            Dashed = mood at the start of each session, solid = at the end. The
            brightest point is your most recent session.
          </p>
        </section>

        {/* Section 3 — Session history */}
        <section className={cardClass} style={{ animation: "fade-in 0.8s ease-out" }}>
          <p className={labelClass}>Session history</p>
          <div className="mt-4 divide-y divide-white/[0.06]">
            {[...ordered].reverse().map((s) => {
              const open = expanded === s.id;
              return (
                <div key={s.id} className="py-4">
                  <button
                    onClick={() => setExpanded(open ? null : s.id)}
                    className="w-full flex items-center justify-between gap-4 text-left group"
                  >
                    <div className="flex items-center gap-6 min-w-0">
                      <span className="text-sm text-white/70 w-16 shrink-0">
                        {formatDate(s.date)}
                      </span>
                      <span className="text-sm text-starlight/80 w-28 shrink-0 truncate">
                        {(s.mood || "—") + " → " + (s.moodEnd || "—")}
                      </span>
                      <span className="text-sm text-white/60 truncate hidden sm:block">
                        {s.topic || "—"}
                      </span>
                    </div>
                    <span className="text-xs text-white/40 shrink-0">
                      {formatDuration(s.duration)}
                    </span>
                  </button>
                  {open && (
                    <p
                      className="mt-3 text-white/70 leading-relaxed italic"
                      style={{ fontFamily: "Georgia, serif", animation: "fade-in 0.3s ease-out" }}
                    >
                      {s.summary || "No summary available for this session."}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4 — Insights */}
        {insights && (
          <section className={cardClass} style={{ animation: "fade-in 0.9s ease-out" }}>
            <p className={labelClass}>Insights</p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-6">
              <Stat label="Sessions" value={`${insights.total}`} big />
              <Stat label="Most common ending mood" value={insights.commonMood} />
              <Stat label="Most common topic" value={insights.commonTopic} />
              <Stat label="This week" value={`${insights.thisWeek} sessions`} />
            </div>
          </section>
        )}

        <div className="pt-2 text-center">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-starlight/70 hover:text-starlight transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Start another session
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  big,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
        {icon}
        {label}
      </span>
      <span
        className={`${big ? "text-3xl" : "text-base"} text-white/90 ${big ? "" : "leading-snug"}`}
        style={big ? { fontFamily: "Georgia, serif" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export default function Page() {
  return (
    <ProtectedRoute>
      <SummaryDashboard />
    </ProtectedRoute>
  );
}
