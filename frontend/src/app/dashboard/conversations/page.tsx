"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  AlertTriangle,
  Clock,
  Loader2,
  Bot,
} from "lucide-react";
import { ProtectedRoute } from "../../Components/ProtectedRoute";
import {
  getSessionsApi,
  getSessionMessagesApi,
  type DbSession,
  type ConversationMessage,
} from "../../lib/api";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m === 0 ? `${s}s` : `${m}m ${s}s`;
}

function ConversationsView() {
  const [sessions, setSessions] = useState<DbSession[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Load the user's sessions (newest first) and auto-select the most recent.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getSessionsApi();
      if (cancelled) return;
      setSessions(s);
      if (s.length > 0) setSelectedId(s[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the selected session's message thread.
  useEffect(() => {
    if (!selectedId) {
      setMessages(null);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    (async () => {
      const m = await getSessionMessagesApi(selectedId);
      if (cancelled) return;
      setMessages(m);
      setLoadingMessages(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = sessions?.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="p-6 md:p-8 mt-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <MessageSquare className="h-6 w-6 mr-2 text-green-500" />
          Conversations
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Your past sessions and full transcripts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left: sessions list */}
        <aside className="rounded-2xl border border-gray-800 bg-white/[0.02]">
          <div className="px-4 py-3 border-b border-gray-800 text-sm font-medium text-gray-300">
            Sessions{sessions ? ` (${sessions.length})` : ""}
          </div>
          <ScrollArea className="h-[60vh] lg:h-[calc(100vh-220px)]">
            <div className="p-3 space-y-2">
              {sessions === null ? (
                <div className="flex items-center justify-center py-10 text-gray-500 text-sm">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading sessions…
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-10 px-4">
                  No sessions yet. Once you finish a conversation, it will show
                  up here.
                </p>
              ) : (
                sessions.map((s) => {
                  const active = s.id === selectedId;
                  const duration = formatDuration(s.durationSec);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        active
                          ? "bg-green-500/10 border-green-500"
                          : "border-gray-800 hover:bg-gray-800/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-white truncate">
                          {formatDateTime(s.createdAt)}
                        </span>
                        {s.crisisFlag && (
                          <Badge className="bg-red-500 text-white shrink-0">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Crisis
                          </Badge>
                        )}
                      </div>
                      {s.topic && (
                        <div className="text-xs text-gray-400 truncate mt-1">
                          {s.topic}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                        {s.mood && <span className="capitalize">{s.mood}</span>}
                        {duration && (
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {duration}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Right: message thread */}
        <section className="rounded-2xl border border-gray-800 bg-white/[0.02] flex flex-col">
          {selected ? (
            <>
              <div className="px-5 py-3 border-b border-gray-800">
                <div className="text-sm font-medium text-white">
                  {formatDateTime(selected.createdAt)}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  {selected.topic && <span>{selected.topic}</span>}
                  {selected.mood && (
                    <span className="capitalize">· {selected.mood}</span>
                  )}
                  {formatDuration(selected.durationSec) && (
                    <span>· {formatDuration(selected.durationSec)}</span>
                  )}
                </div>
              </div>

              <ScrollArea className="h-[55vh] lg:h-[calc(100vh-260px)]">
                <div className="p-5 space-y-4">
                  {loadingMessages || messages === null ? (
                    <div className="flex items-center justify-center py-10 text-gray-500 text-sm">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading conversation…
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-10">
                      No messages were recorded for this session.
                    </p>
                  ) : (
                    messages.map((m) => {
                      const isUser = m.sender === "USER";
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "flex",
                            isUser ? "justify-end" : "justify-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[78%] rounded-2xl px-4 py-2",
                              isUser
                                ? "bg-green-500 text-black rounded-br-sm"
                                : "bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-sm",
                            )}
                          >
                            {!isUser && (
                              <div className="flex items-center text-[10px] uppercase tracking-wide text-green-500 mb-1">
                                <Bot className="h-3 w-3 mr-1" />
                                Therapist
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {m.content}
                            </p>
                            <div
                              className={cn(
                                "text-[10px] mt-1",
                                isUser ? "text-black/50" : "text-gray-500",
                              )}
                            >
                              {formatTime(m.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm py-20">
              {sessions && sessions.length === 0
                ? "No conversations to show yet."
                : "Select a session to view its conversation."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <ProtectedRoute>
      <ConversationsView />
    </ProtectedRoute>
  );
}
