"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  CalendarDays,
  Database,
  Loader2,
  Network,
  Sparkles,
} from "lucide-react";
import { ProtectedRoute } from "../../Components/ProtectedRoute";
import {
  getMemoriesApi,
  getMemoryGraphApi,
  type HydraMemoriesDashboard,
  type HydraMemoryGraphEdge,
  type HydraMemoryGraphNode,
  type HydraMemoryGraphResponse,
} from "../../lib/api";

const cardClass = "bg-gray-900 border-gray-800";

type PositionedNode = HydraMemoryGraphNode & { x: number; y: number };

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}...` : id;
}

function formatDate(iso: string | null): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function nodeFill(node: HydraMemoryGraphNode): string {
  if (node.isPrimary) return "#eab308";
  return "#f97316";
}

function forceDirectedLayout(
  nodes: HydraMemoryGraphNode[],
  edges: HydraMemoryGraphEdge[],
  width: number,
  height: number,
): PositionedNode[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [{ ...nodes[0], x: width / 2, y: height / 2 }];
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const positioned: PositionedNode[] = nodes.map((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const radius = Math.min(width, height) * 0.28;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  const byId = new Map(positioned.map((node) => [node.id, node]));

  for (let step = 0; step < 90; step += 1) {
    for (let i = 0; i < positioned.length; i += 1) {
      for (let j = i + 1; j < positioned.length; j += 1) {
        const a = positioned[i];
        const b = positioned[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const force = 5200 / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        a.x -= dx;
        a.y -= dy;
        b.x += dx;
        b.y += dy;
      }
    }

    for (const edge of edges) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) continue;
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const force = (dist - 140) * 0.04;
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      source.x += dx;
      source.y += dy;
      target.x -= dx;
      target.y -= dy;
    }

    for (const node of positioned) {
      node.x += (centerX - node.x) * 0.02;
      node.y += (centerY - node.y) * 0.02;
      node.x = Math.max(70, Math.min(width - 70, node.x));
      node.y = Math.max(70, Math.min(height - 70, node.y));
    }
  }

  return positioned;
}

function MemoryGraph({
  graph,
  title,
  sourceId,
  loading,
  error,
  emptyMessage,
}: {
  graph: HydraMemoryGraphResponse["graph"] | null;
  title: string | null;
  sourceId: string | null;
  loading: boolean;
  error: string | null;
  emptyMessage: string;
}) {
  const layout = useMemo(() => {
    const width = 760;
    const height = 460;
    const nodes = graph?.nodes ?? [];
    const edges = graph?.edges ?? [];
    const positioned = forceDirectedLayout(nodes, edges, width, height);
    const byId = new Map(positioned.map((node) => [node.id, node]));
    return { width, height, nodes: positioned, byId, edges };
  }, [graph]);

  return (
    <Card className={cardClass}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-white flex items-center gap-2">
              <Network className="h-5 w-5 text-green-500" />
              Knowledge Graph
            </CardTitle>
            <CardDescription className="text-gray-400">
              {title
                ? `Knowledge graph extracted from this memory. ${graph?.entityCount ?? 0} entities • ${graph?.relationCount ?? 0} relations`
                : "Select a memory card to view its HydraDB knowledge graph"}
            </CardDescription>
            {sourceId && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge className="bg-rose-500/10 text-rose-300 border-rose-500/20">
                  MEMORY
                </Badge>
                <span className="text-xs text-gray-500 font-mono">{sourceId}</span>
              </div>
            )}
          </div>
          {graph && graph.entityCount > 0 && (
            <Badge className="bg-green-500/10 text-green-400 border-green-500/20 shrink-0">
              GRAPH
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-14 text-center text-sm text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-green-500" />
            Loading graph...
          </div>
        ) : error ? (
          <div className="py-14 text-center">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        ) : !graph || graph.entityCount === 0 ? (
          <div className="py-14 text-center">
            <Network className="h-9 w-9 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{emptyMessage}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-[#f3f4f6]">
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="min-w-[720px] w-full h-[460px]"
              role="img"
              aria-label="HydraDB knowledge graph"
            >
              <defs>
                <marker
                  id="graph-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                </marker>
              </defs>
              {layout.edges.map((edge) => {
                const source = layout.byId.get(edge.source);
                const target = layout.byId.get(edge.target);
                if (!source || !target) return null;

                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const dist = Math.max(Math.hypot(dx, dy), 1);
                const nodeRadius = 24;
                const x1 = source.x + (dx / dist) * nodeRadius;
                const y1 = source.y + (dy / dist) * nodeRadius;
                const x2 = target.x - (dx / dist) * (nodeRadius + 4);
                const y2 = target.y - (dy / dist) * (nodeRadius + 4);

                return (
                  <line
                    key={edge.id}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#64748b"
                    strokeWidth="2"
                    markerEnd="url(#graph-arrow)"
                  />
                );
              })}
              {layout.nodes.map((node) => (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={24}
                    fill={nodeFill(node)}
                    stroke="#ffffff"
                    strokeWidth="3"
                  />
                  <text
                    x={node.x}
                    y={node.y - 34}
                    textAnchor="middle"
                    className="fill-slate-700 text-[13px] font-medium"
                  >
                    {node.label.length > 22
                      ? `${node.label.slice(0, 22)}...`
                      : node.label}
                  </text>
                </g>
              ))}
            </svg>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-300 bg-white/70">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" />
                  Primary entity
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
                  Related entity
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Directed edges show extracted relationships
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemoriesView() {
  const [data, setData] = useState<HydraMemoriesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<HydraMemoryGraphResponse | null>(
    null,
  );
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getMemoriesApi()
      .then((result) => {
        if (!mounted) return;
        if (!result) {
          setError("Unable to load HydraDB memories.");
          return;
        }
        setData(result);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load memories.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loadMemoryGraph = useCallback(async (memoryId: string) => {
    setSelectedMemoryId(memoryId);
    setGraphLoading(true);
    setGraphError(null);
    setGraphData(null);

    try {
      const result = await getMemoryGraphApi(memoryId);
      if (!result) {
        setGraphError("Unable to load graph for this memory.");
        return;
      }
      setGraphData(result);
    } catch (err) {
      setGraphError(
        err instanceof Error ? err.message : "Failed to load memory graph.",
      );
    } finally {
      setGraphLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="p-8 mt-10 flex items-center justify-center text-gray-500 text-sm h-[60vh]">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading memories...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 mt-10 max-w-5xl">
        <Card className={cardClass}>
          <CardContent className="py-12 text-center">
            <Brain className="h-9 w-9 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-300">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const memories = data?.memories ?? [];
  const graph = graphData?.graph ?? null;

  return (
    <div className="p-8 mt-10 max-w-7xl">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <Brain className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Memories</h1>
              <p className="text-sm text-gray-400 mt-1">
                Long-term HydraDB context scoped to your user account
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-gray-800 text-gray-300 border-gray-700">
            Tenant: {data?.tenantId ?? "unknown"}
          </Badge>
          <Badge className="bg-gray-800 text-gray-300 border-gray-700">
            User: {shortId(data?.subTenantId ?? "")}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Stored Memories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">
              {memories.length}
            </div>
          </CardContent>
        </Card>
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Graph Entities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">
              {graph?.entityCount ?? "—"}
            </div>
          </CardContent>
        </Card>
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Graph Relations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">
              {graph?.relationCount ?? "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
        <MemoryGraph
          graph={graph}
          title={graphData?.title ?? null}
          sourceId={graphData?.sourceId ?? null}
          loading={graphLoading}
          error={graphError}
          emptyMessage="Click “View graph” on a memory card to see its extracted entity relationships."
        />

        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-green-500" />
              Memory Cards
            </CardTitle>
            <CardDescription className="text-gray-400">
              Distilled context HydraDB has stored for this user
            </CardDescription>
          </CardHeader>
          <CardContent>
            {memories.length === 0 ? (
              <div className="py-10 text-center">
                <Sparkles className="h-8 w-8 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  No memories yet. Complete a session and wait for HydraDB
                  ingestion to finish.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                {memories.map((memory, index) => {
                  const isSelected = selectedMemoryId === memory.id;
                  return (
                    <div
                      key={memory.id}
                      className={`rounded-2xl border bg-black/35 p-4 transition-colors ${
                        isSelected
                          ? "border-green-500/50 ring-1 ring-green-500/20"
                          : "border-gray-800 hover:border-green-500/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {memory.title || `Memory ${index + 1}`}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            ID: {shortId(memory.id)}
                          </p>
                        </div>
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                          HydraDB
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {memory.content}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(memory.createdAt)}
                          </span>
                          {memory.sourceId && (
                            <span>Source: {shortId(memory.sourceId)}</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          className={
                            isSelected
                              ? "bg-green-600 hover:bg-green-500 text-white border-0"
                              : "border-gray-700 text-gray-200 hover:bg-gray-800 hover:text-white"
                          }
                          disabled={graphLoading && isSelected}
                          onClick={() => loadMemoryGraph(memory.id)}
                        >
                          {graphLoading && isSelected ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Loading
                            </>
                          ) : (
                            <>
                              <Network className="h-3.5 w-3.5 mr-1.5" />
                              View graph
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-xs text-gray-500">
        Memories are read with <span className="text-gray-400">sub_tenant_id</span>{" "}
        equal to the current authenticated user id.
      </div>
    </div>
  );
}

export default function MemoriesPage() {
  return (
    <ProtectedRoute>
      <MemoriesView />
    </ProtectedRoute>
  );
}
