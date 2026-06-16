"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Download,
  Upload,
  Sparkles,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  Activity,
  AlertCircle,
  Heart,
} from "lucide-react";
import { ProtectedRoute } from "../../Components/ProtectedRoute";
import {
  listReportsApi,
  generateReportApi,
  uploadReportApi,
  getRatingsSummaryApi,
  backfillRatingsApi,
  backfillMoodsApi,
  type Report,
  type RatingsSummary,
} from "../../lib/api";
import { cn } from "@/lib/utils";

const cardClass = "bg-gray-900 border-gray-800";

const METRIC_LABELS: Record<string, string> = {
  empathy: "Empathy",
  conciseness: "Conciseness",
  task_completion: "Task Completion",
  safety_guardrail: "Safety & Guardrails",
  active_listening: "Active Listening",
};

const METRIC_DESCRIPTIONS: Record<string, string> = {
  empathy: "Warmth, validation, and emotional attunement",
  conciseness: "Appropriately brief responses without rambling",
  task_completion: "Helped explore or make progress on the client's concern",
  safety_guardrail: "Handled risk appropriately; avoided harmful advice",
  active_listening: "Reflected feelings and tracked what the client said",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function scoreColor(score: number): string {
  if (score >= 4) return "text-green-500";
  if (score >= 3) return "text-yellow-500";
  return "text-red-400";
}

function ReportsView() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [ratings, setRatings] = useState<RatingsSummary | null | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [backfillingMoods, setBackfillingMoods] = useState(false);
  const [moodMsg, setMoodMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratingExpanded, setRatingExpanded] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [r, rt] = await Promise.all([listReportsApi(), getRatingsSummaryApi()]);
    setReports(r);
    setRatings(rt);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const report = await generateReportApi();
      setReports((prev) => [report, ...(prev ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const report = await uploadReportApi(file);
      setReports((prev) => [report, ...(prev ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to upload report");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleScoreSessions = async () => {
    setError(null);
    setScoring(true);
    try {
      await backfillRatingsApi();
      const updated = await getRatingsSummaryApi();
      setRatings(updated);
      setRatingExpanded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to score sessions");
    } finally {
      setScoring(false);
    }
  };

  const handleBackfillMoods = async () => {
    setError(null);
    setMoodMsg(null);
    setBackfillingMoods(true);
    try {
      const { derived } = await backfillMoodsApi();
      setMoodMsg(
        derived > 0
          ? `Derived mood for ${derived} session${derived === 1 ? "" : "s"}. Your mood graph is now up to date.`
          : "All sessions already have a mood — nothing to backfill.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to backfill moods");
    } finally {
      setBackfillingMoods(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 mt-10 flex items-center justify-center text-gray-500 text-sm h-[60vh]">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading reports…
      </div>
    );
  }

  const hasRatings = ratings != null;

  return (
    <div className="p-8 mt-10 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reports</h1>
          <p className="text-sm text-gray-400 mt-1">
            Generate clinical summaries or upload your own documents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <Button
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
            disabled={backfillingMoods}
            onClick={handleBackfillMoods}
          >
            {backfillingMoods ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Heart className="h-4 w-4 mr-2" />
            )}
            Backfill Moods
          </Button>
          <Button
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
            disabled={uploading || generating}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Upload Report
          </Button>
          <Button
            className="bg-green-500 hover:bg-green-600 text-black"
            disabled={generating || uploading}
            onClick={handleGenerate}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Report
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {generating && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          Generating your report from recent sessions — this may take a minute…
        </div>
      )}

      {backfillingMoods && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          Analyzing past transcripts to derive each session&apos;s mood — this may
          take a moment…
        </div>
      )}

      {moodMsg && !backfillingMoods && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          <Heart className="h-4 w-4 shrink-0" />
          {moodMsg}
        </div>
      )}

      {/* Session Quality Rating */}
      <Card className={cn(cardClass, "mb-8")}>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => hasRatings && setRatingExpanded((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              <div>
                <CardTitle className="text-white">Session Quality Rating</CardTitle>
                <CardDescription className="text-gray-400">
                  AI therapist performance across your graded sessions
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasRatings ? (
                <>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Star className="h-4 w-4 text-green-500 fill-green-500" />
                      <span className="text-2xl font-bold text-white">
                        {ratings.overall}
                      </span>
                      <span className="text-gray-400 text-sm">/5</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {ratings.count} session{ratings.count !== 1 ? "s" : ""} scored
                    </p>
                  </div>
                  {ratingExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </>
              ) : (
                <Button
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-black"
                  disabled={scoring}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleScoreSessions();
                  }}
                >
                  {scoring ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Star className="h-4 w-4 mr-2" />
                  )}
                  Score Sessions
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {hasRatings && ratingExpanded && (
          <CardContent className="pt-0">
            <div className="space-y-4 border-t border-gray-800 pt-4">
              {ratings.metrics.map((m) => (
                <div key={m.metric}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-medium text-white">
                        {METRIC_LABELS[m.metric] ?? m.metric}
                      </span>
                      <p className="text-xs text-gray-500">
                        {METRIC_DESCRIPTIONS[m.metric]}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        scoreColor(m.score),
                      )}
                    >
                      {m.score}/5
                    </span>
                  </div>
                  <Progress value={(m.score / 5) * 100} className="h-2" />
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                  disabled={scoring}
                  onClick={handleScoreSessions}
                >
                  {scoring ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : null}
                  Re-score ungraded sessions
                </Button>
              </div>
            </div>
          </CardContent>
        )}

        {hasRatings && !ratingExpanded && (
          <CardContent className="pt-0 pb-4">
            <p className="text-xs text-gray-500">
              Tap to expand and see scores for empathy, conciseness, task completion,
              safety, and active listening
            </p>
          </CardContent>
        )}

        {!hasRatings && !scoring && (
          <CardContent className="pt-0">
            <p className="text-sm text-gray-500">
              No sessions scored yet. Score your past sessions to see how well the AI
              therapist performed across five quality metrics.
            </p>
          </CardContent>
        )}

        {scoring && !hasRatings && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scoring your sessions — this may take a minute…
            </div>
          </CardContent>
        )}
      </Card>

      {/* Reports List */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <FileText className="h-5 w-5 mr-2 text-green-500" />
            Your Reports
          </CardTitle>
          <CardDescription className="text-gray-400">
            Generated summaries and uploaded documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!reports || reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No reports yet</p>
              <p className="text-gray-500 text-xs mt-1 max-w-sm mx-auto">
                Generate a clinical report from your last 3 sessions, or upload a PDF
                or DOCX file from your therapist.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const isExpanded = expandedReportId === report.id;
                return (
                  <div
                    key={report.id}
                    className="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() =>
                          setExpandedReportId(isExpanded ? null : report.id)
                        }
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-white truncate">
                            {report.title}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-xs",
                              report.type === "GENERATED"
                                ? "border-green-500/40 text-green-400"
                                : "border-blue-500/40 text-blue-400",
                            )}
                          >
                            {report.type === "GENERATED" ? "Generated" : "Uploaded"}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatDate(report.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        {report.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-600 text-gray-300 hover:bg-gray-700 bg-transparent"
                            asChild
                          >
                            <a
                              href={report.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {(report.summary || report.mostCommonIssues.length > 0) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white"
                            onClick={() =>
                              setExpandedReportId(isExpanded ? null : report.id)
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-700 pt-3 space-y-3">
                        {report.mostCommonIssues.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                              Common Issues
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {report.mostCommonIssues.map((issue) => (
                                <Badge
                                  key={issue}
                                  variant="secondary"
                                  className="bg-gray-700 text-gray-200"
                                >
                                  {issue}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {report.summary && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                              Summary
                            </p>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-12">
                              {report.summary}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsView />
    </ProtectedRoute>
  );
}
