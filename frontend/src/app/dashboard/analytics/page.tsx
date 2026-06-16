"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  MessageSquare,
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Brain,
  Loader2,
  Activity,
} from "lucide-react";
import { ProtectedRoute } from "../../Components/ProtectedRoute";
import {
  getAnalyticsApi,
  type AnalyticsRange,
  type UserAnalytics,
} from "../../lib/api";
import { moodToScore } from "@/lib/sessionStorage";

const SCORE_LABELS: Record<number, string> = {
  1: "Overwhelmed",
  2: "Numb",
  3: "Sad",
  4: "Anxious",
  5: "Angry",
  6: "Okay",
};

const GREEN = "#22c55e";

function formatTotalTime(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)}m`;
}

function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function hourLabel(h: number): string {
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${am ? "a" : "p"}`;
}

const cardClass = "bg-gray-900 border-gray-800";
const chartGrid = "rgba(255,255,255,0.06)";
const axisTick = { fill: "rgba(255,255,255,0.45)", fontSize: 11 };
const tooltipStyle = {
  background: "hsl(240, 20%, 8%)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  color: "#fff",
} as const;

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
}) {
  return (
    <Card className={cardClass}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-400">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{value}</div>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function AnalyticsView() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [data, setData] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await getAnalyticsApi(range);
      if (cancelled) return;
      setData(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const moodData = useMemo(
    () =>
      (data?.moodTimeline ?? []).map((m) => ({
        label: shortDate(m.date),
        score: moodToScore(m.mood),
        mood: m.mood,
      })),
    [data],
  );

  const sessionsData = useMemo(
    () =>
      (data?.sessionsByDay ?? []).map((d) => ({
        label: shortDate(d.date),
        count: d.count,
      })),
    [data],
  );

  const topicData = useMemo(
    () => (data?.topicDistribution ?? []).slice(0, 6),
    [data],
  );

  const hourData = useMemo(
    () =>
      (data?.timeOfDay ?? []).map((h) => ({
        label: hourLabel(h.hour),
        count: h.count,
      })),
    [data],
  );

  const insights = useMemo(() => {
    if (!data || data.totalSessions === 0) return [];
    const out: string[] = [];
    if (data.moodDistribution[0])
      out.push(`Your most common starting mood is "${data.moodDistribution[0].mood}".`);
    if (data.topicDistribution[0])
      out.push(`You talk about "${data.topicDistribution[0].topic}" most often.`);
    out.push(
      `${data.sessionsThisWeek} session${data.sessionsThisWeek === 1 ? "" : "s"} in the last 7 days.`,
    );
    if (data.currentStreakDays > 1)
      out.push(`You're on a ${data.currentStreakDays}-day streak.`);
    if (moodData.length >= 2) {
      const first = moodData[0].score;
      const last = moodData[moodData.length - 1].score;
      if (last > first) out.push("Your mood is trending up over this period.");
      else if (last < first) out.push("Your mood has dipped over this period.");
    }
    out.push(`Your sessions average ${formatMinutes(data.avgDurationSec)}.`);
    return out;
  }, [data, moodData]);

  if (loading && !data) {
    return (
      <div className="p-8 mt-10 flex items-center justify-center text-gray-500 text-sm h-[60vh]">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading your analytics…
      </div>
    );
  }

  const empty = !data || data.totalSessions === 0;

  return (
    <div className="p-8 mt-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <BarChart3 className="h-6 w-6 mr-2 text-green-500" />
          Analytics
        </h1>
        <Select value={range} onValueChange={(v) => setRange(v as AnalyticsRange)}>
          <SelectTrigger className="w-32 bg-gray-900 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            <SelectItem value="7d">7 Days</SelectItem>
            <SelectItem value="30d">30 Days</SelectItem>
            <SelectItem value="90d">90 Days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {empty ? (
        <Card className={cardClass}>
          <CardContent className="py-16 text-center">
            <Activity className="h-10 w-10 text-green-500 mx-auto mb-4" />
            <p className="text-white font-medium">No sessions in this range yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Finish a conversation and your analytics will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-gray-900 border border-gray-800">
              {["overview", "engagement", "insights"].map((t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="capitalize data-[state=active]:bg-green-500 data-[state=active]:text-black"
                >
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview: mood over time + sessions over time */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className={cardClass}>
                  <CardHeader>
                    <CardTitle className="text-white">Mood over time</CardTitle>
                    <CardDescription className="text-gray-400">
                      Starting mood per session
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {moodData.length === 0 ? (
                      <p className="text-sm text-gray-500 py-10 text-center">
                        No mood data recorded yet.
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={256}>
                        <LineChart data={moodData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                          <XAxis dataKey="label" tick={axisTick} tickLine={false} />
                          <YAxis
                            domain={[1, 6]}
                            ticks={[1, 2, 3, 4, 5, 6]}
                            width={92}
                            tick={axisTick}
                            tickLine={false}
                            tickFormatter={(v: number) => SCORE_LABELS[v] ?? ""}
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(_v, _n, item) => [
                              (item?.payload as { mood?: string })?.mood ?? "",
                              "Mood",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke={GREEN}
                            strokeWidth={2}
                            dot={{ r: 3, fill: GREEN }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className={cardClass}>
                  <CardHeader>
                    <CardTitle className="text-white">Sessions over time</CardTitle>
                    <CardDescription className="text-gray-400">
                      When you showed up
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={256}>
                      <BarChart data={sessionsData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                        <XAxis dataKey="label" tick={axisTick} tickLine={false} />
                        <YAxis
                          allowDecimals={false}
                          tick={axisTick}
                          tickLine={false}
                          width={28}
                        />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <Bar dataKey="count" fill={GREEN} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Engagement: messages, topics, time-of-day */}
            <TabsContent value="engagement" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                  title="Total Messages"
                  value={`${data.messages.total}`}
                  subtitle={`${data.messages.avgPerSession} per session`}
                  icon={<MessageSquare className="h-4 w-4 text-green-500" />}
                />
                <MetricCard
                  title="Crisis Flags"
                  value={`${data.crisisCount}`}
                  subtitle={data.crisisCount === 0 ? "None — good" : "Sessions flagged"}
                  icon={<AlertTriangle className="h-4 w-4 text-green-500" />}
                />
                <MetricCard
                  title="Days Since Last"
                  value={data.daysSinceLast != null ? `${data.daysSinceLast}` : "—"}
                  subtitle="Since your last session"
                  icon={<CalendarDays className="h-4 w-4 text-green-500" />}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className={cardClass}>
                  <CardHeader>
                    <CardTitle className="text-white">You vs Therapist</CardTitle>
                    <CardDescription className="text-gray-400">
                      Share of messages
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    {(() => {
                      const total = data.messages.total || 1;
                      const userPct = Math.round((data.messages.user / total) * 100);
                      return (
                        <>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-400">You</span>
                              <span className="text-white">
                                {data.messages.user} ({userPct}%)
                              </span>
                            </div>
                            <Progress value={userPct} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-400">Therapist</span>
                              <span className="text-white">
                                {data.messages.ai} ({100 - userPct}%)
                              </span>
                            </div>
                            <Progress value={100 - userPct} className="h-2" />
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Card className={cardClass}>
                  <CardHeader>
                    <CardTitle className="text-white">Time of day</CardTitle>
                    <CardDescription className="text-gray-400">
                      When you usually have sessions (UTC)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {hourData.length === 0 ? (
                      <p className="text-sm text-gray-500 py-8 text-center">
                        Not enough data yet.
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={hourData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                          <XAxis dataKey="label" tick={axisTick} tickLine={false} />
                          <YAxis allowDecimals={false} tick={axisTick} tickLine={false} width={28} />
                          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                          <Bar dataKey="count" fill={GREEN} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="text-white">What you talk about</CardTitle>
                  <CardDescription className="text-gray-400">
                    Most common topics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topicData.length === 0 ? (
                    <p className="text-sm text-gray-500 py-8 text-center">
                      No topics recorded yet.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(160, topicData.length * 44)}>
                      <BarChart data={topicData} layout="vertical" margin={{ left: 16, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="topic"
                          width={140}
                          tick={axisTick}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <Bar dataKey="count" fill={GREEN} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insights: real derived observations */}
            <TabsContent value="insights" className="space-y-6">
              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-green-500" />
                    Your patterns
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Observations from your own sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {insights.map((text, i) => {
                      const down = text.includes("dipped");
                      return (
                        <li
                          key={i}
                          className="flex items-start p-3 rounded-lg bg-gray-800 border border-gray-700"
                        >
                          {down ? (
                            <TrendingDown className="h-4 w-4 text-red-400 mr-3 mt-0.5 shrink-0" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-green-500 mr-3 mt-0.5 shrink-0" />
                          )}
                          <span className="text-sm text-gray-200">{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsView />
    </ProtectedRoute>
  );
}
