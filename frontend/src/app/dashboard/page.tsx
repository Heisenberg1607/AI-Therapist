"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  MessageSquare,
  Activity,
  Sparkles,
  ArrowRight,
  Loader2,
  Heart,
  Hash,
  CalendarDays,
} from "lucide-react";
import { ProtectedRoute } from "../Components/ProtectedRoute";
import {
  getAnalyticsApi,
  getSessionsApi,
  type UserAnalytics,
  type DbSession,
} from "../lib/api";
import { moodToScore } from "@/lib/sessionStorage";

const cardClass = "bg-gray-900 border-gray-800";
const GREEN = "#22c55e";

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)}m`;
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function initialsFromDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}`.padStart(2, "0");
}

function OverviewView() {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [sessions, setSessions] = useState<DbSession[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [a, s] = await Promise.all([
        getAnalyticsApi("all"),
        getSessionsApi(),
      ]);
      if (cancelled) return;
      setAnalytics(a);
      setSessions(s);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const moodData = useMemo(
    () =>
      (analytics?.moodTimeline ?? []).map((m) => ({
        label: shortDate(m.date),
        start: m.moodStart ? moodToScore(m.moodStart) : null,
        end: m.moodEnd ? moodToScore(m.moodEnd) : null,
      })),
    [analytics],
  );

  const recent = useMemo(() => (sessions ?? []).slice(0, 5), [sessions]);

  if (loading) {
    return (
      <div className="p-8 mt-10 flex items-center justify-center text-gray-500 text-sm h-[60vh]">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading your dashboard…
      </div>
    );
  }

  const a = analytics;
  const empty = !a || a.totalSessions === 0;

  if (empty) {
    return (
      <div className="p-8 mt-10">
        <Card className={cardClass}>
          <CardContent className="py-16 text-center">
            <Sparkles className="h-10 w-10 text-green-500 mx-auto mb-4" />
            <p className="text-white font-medium">Welcome 👋</p>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              You haven&apos;t had any sessions yet. Start one and your dashboard
              will fill up.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black font-semibold px-6 py-2.5 rounded-lg text-sm"
            >
              Start a session <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const topMood = a.moodDistribution[0]?.mood ?? "—";
  const topTopic = a.topicDistribution[0]?.topic ?? "—";

  return (
    <div className="p-8 mt-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: recent sessions + mood trend */}
        <div className="lg:col-span-2 space-y-6">
          <Card className={cardClass}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-green-500" />
                    Recent Sessions
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Your latest conversations
                  </CardDescription>
                </div>
                <Link
                  href="/dashboard/conversations"
                  className="text-sm text-green-500 hover:underline flex items-center"
                >
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recent.map((s) => (
                  <Link
                    key={s.id}
                    href="/dashboard/conversations"
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-green-500 text-black font-semibold">
                          {initialsFromDate(s.createdAt)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">
                          {s.topic || "Session"}
                        </p>
                        <p className="text-sm text-gray-400">
                          {shortDate(s.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 shrink-0">
                      {s.durationSec != null && (
                        <span className="text-sm text-gray-400">
                          {formatMinutes(s.durationSec)}
                        </span>
                      )}
                      {s.mood && (
                        <Badge className="bg-gray-700 text-gray-200 capitalize">
                          {s.mood}
                        </Badge>
                      )}
                      {s.crisisFlag && (
                        <Badge className="bg-red-500 text-white">Crisis</Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Heart className="h-5 w-5 mr-2 text-green-500" />
                Mood trend
              </CardTitle>
              <CardDescription className="text-gray-400">
                Mood at the start vs end of each session
              </CardDescription>
            </CardHeader>
            <CardContent>
              {moodData.length < 2 ? (
                <p className="text-sm text-gray-500 py-8 text-center">
                  Not enough mood data yet to chart a trend.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={moodData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[1, 6]}
                      ticks={[1, 2, 3, 4, 5, 6]}
                      tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                      tickLine={false}
                      width={24}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(240, 20%, 8%)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 12,
                        color: "#fff",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="start"
                      name="Start"
                      stroke={GREEN}
                      strokeOpacity={0.4}
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={{ r: 2, fill: GREEN, fillOpacity: 0.4 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="end"
                      name="End"
                      stroke={GREEN}
                      strokeWidth={2}
                      dot={{ r: 3, fill: GREEN }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: at a glance + quick action */}
        <div className="space-y-6">
          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className="text-white">At a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Glance
                icon={<Heart className="h-4 w-4 text-green-500" />}
                label="Most common ending mood"
                value={topMood}
              />
              <Glance
                icon={<Hash className="h-4 w-4 text-green-500" />}
                label="Most common topic"
                value={topTopic}
              />
              <Glance
                icon={<MessageSquare className="h-4 w-4 text-green-500" />}
                label="Messages exchanged"
                value={`${a.messages.total}`}
              />
              <Glance
                icon={<CalendarDays className="h-4 w-4 text-green-500" />}
                label="Days since last session"
                value={a.daysSinceLast != null ? `${a.daysSinceLast}` : "—"}
              />
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className="text-white">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/chat"
                className="w-full inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-black font-semibold px-4 py-2.5 rounded-lg text-sm"
              >
                <MessageSquare className="h-4 w-4" />
                Start a session
              </Link>
              <Link
                href="/dashboard/analytics"
                className="w-full inline-flex items-center justify-center gap-2 border border-gray-600 text-gray-300 hover:bg-gray-800 px-4 py-2.5 rounded-lg text-sm"
              >
                <Activity className="h-4 w-4" />
                View analytics
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Glance({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-gray-400">
        {icon}
        {label}
      </span>
      <span className="text-sm text-white font-medium capitalize">{value}</span>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <ProtectedRoute>
      <OverviewView />
    </ProtectedRoute>
  );
}
