type HydraMemoryRecord = {
  id: string;
  content: string;
  title: string | null;
  sourceId: string | null;
  createdAt: string | null;
};

type HydraGraphNode = {
  id: string;
  label: string;
  type: "entity" | "memory" | "concept";
  entityType: string | null;
  isPrimary: boolean;
};

type HydraGraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export type HydraMemoryDashboard = {
  tenantId: string;
  subTenantId: string;
  memories: HydraMemoryRecord[];
};

export type HydraMemoryGraph = {
  nodes: HydraGraphNode[];
  edges: HydraGraphEdge[];
  entityCount: number;
  relationCount: number;
};

export type HydraMemoryGraphResponse = {
  memoryId: string;
  title: string | null;
  sourceId: string;
  graph: HydraMemoryGraph;
};

const API_BASE = (process.env.HYDRA_DB_API_BASE || "https://api.hydradb.com").replace(/\/$/, "");
const TENANT_ID = process.env.HYDRA_DB_TENANT_ID || "ai-therapist";
const API_KEY = (process.env.HYDRA_DB_API_KEY || "").trim();

async function postHydra<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  if (!API_KEY) {
    throw new Error("HYDRA_DB_API_KEY is not configured");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HydraDB ${path} returned ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

async function getHydra<T>(
  path: string,
  params: Record<string, string | number | boolean>,
): Promise<T> {
  if (!API_KEY) {
    throw new Error("HYDRA_DB_API_KEY is not configured");
  }

  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HydraDB ${path} returned ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMemory(record: unknown): HydraMemoryRecord | null {
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  const id = asString(r.memory_id) || asString(r.id) || asString(r.uuid);
  const content =
    asString(r.memory_content) ||
    asString(r.content) ||
    asString(r.text) ||
    asString(r.chunk_content);

  if (!id || !content) return null;

  return {
    id,
    content,
    title: asString(r.title) || asString(r.source_title),
    sourceId: asString(r.source_id) || asString(r.sourceId),
    createdAt: asString(r.created_at) || asString(r.createdAt),
  };
}

function extractMemoryRecords(data: unknown): HydraMemoryRecord[] {
  const lists: unknown[] = [];
  if (Array.isArray(data)) {
    lists.push(data);
  } else if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["user_memories", "memories", "data", "items", "results"]) {
      if (Array.isArray(d[key])) lists.push(d[key]);
    }
  }

  const out: HydraMemoryRecord[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const item of list as unknown[]) {
      const memory = normalizeMemory(item);
      if (!memory || seen.has(memory.id)) continue;
      seen.add(memory.id);
      out.push(memory);
    }
  }
  return out;
}

function nodeId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function resolveMemorySourceId(memory: HydraMemoryRecord): string {
  if (memory.sourceId) return memory.sourceId;
  if (memory.id.startsWith("session:")) return memory.id;
  return memory.id;
}

type HydraEntityRecord = {
  name: string;
  type: string | null;
  entityId: string;
};

function parseEntity(value: unknown): HydraEntityRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = asString(record.name);
  if (!name) return null;
  return {
    name,
    type: asString(record.type),
    entityId: asString(record.entity_id) || nodeId(name),
  };
}

function extractRelations(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  const relations = (data as Record<string, unknown>).relations;
  return Array.isArray(relations) ? relations : [];
}

function isPrimaryEntity(entity: HydraEntityRecord): boolean {
  if (entity.type?.toUpperCase() === "PERSON") return true;
  return entity.name.toLowerCase() === "user";
}

function buildGraphFromRelations(data: unknown): HydraMemoryGraph {
  const nodes = new Map<string, HydraGraphNode>();
  const edges = new Map<string, HydraGraphEdge>();
  const sourceCounts = new Map<string, number>();

  const ensureNode = (entity: HydraEntityRecord) => {
    if (!nodes.has(entity.entityId)) {
      nodes.set(entity.entityId, {
        id: entity.entityId,
        label: entity.name,
        type: "entity",
        entityType: entity.type,
        isPrimary: isPrimaryEntity(entity),
      });
    }
  };

  for (const item of extractRelations(data)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const source = parseEntity(record.source);
    const target = parseEntity(record.target);
    if (!source || !target) continue;

    ensureNode(source);
    ensureNode(target);

    sourceCounts.set(source.entityId, (sourceCounts.get(source.entityId) ?? 0) + 1);

    const evidence = Array.isArray(record.relations) ? record.relations : [];
    const firstEvidence =
      evidence.find((entry) => entry && typeof entry === "object") as
        | Record<string, unknown>
        | undefined;

    const predicate =
      asString(firstEvidence?.raw_predicate) ||
      asString(firstEvidence?.canonical_predicate) ||
      "related to";

    const edgeId = `${source.entityId}->${target.entityId}:${predicate}`;
    if (!edges.has(edgeId)) {
      edges.set(edgeId, {
        id: edgeId,
        source: source.entityId,
        target: target.entityId,
        label: predicate,
      });
    }
  }

  if (nodes.size > 0 && ![...nodes.values()].some((node) => node.isPrimary)) {
    let topId: string | null = null;
    let topCount = -1;
    for (const [id, count] of sourceCounts.entries()) {
      if (count > topCount) {
        topId = id;
        topCount = count;
      }
    }
    if (topId && nodes.has(topId)) {
      nodes.get(topId)!.isPrimary = true;
    }
  }

  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()];

  return {
    nodes: nodeList,
    edges: edgeList,
    entityCount: nodeList.length,
    relationCount: edgeList.length,
  };
}

async function fetchGraphRelationsForSource(
  userId: string,
  sourceId: string,
  isMemory: boolean,
): Promise<unknown> {
  return getHydra<unknown>("/list/graph_relations_by_id", {
    source_id: sourceId,
    tenant_id: TENANT_ID,
    sub_tenant_id: userId,
    is_memory: isMemory,
    limit: 250,
  });
}

async function listUserMemories(userId: string): Promise<HydraMemoryRecord[]> {
  const listData = await postHydra<unknown>("/list/data", {
    tenant_id: TENANT_ID,
    sub_tenant_id: userId,
    kind: "memories",
  });
  return extractMemoryRecords(listData);
}

export async function getHydraMemoryDashboard(
  userId: string,
): Promise<HydraMemoryDashboard> {
  const memories = await listUserMemories(userId);

  return {
    tenantId: TENANT_ID,
    subTenantId: userId,
    memories,
  };
}

export async function getHydraMemoryGraph(
  userId: string,
  memoryId: string,
): Promise<HydraMemoryGraphResponse> {
  const memories = await listUserMemories(userId);
  const memory = memories.find((item) => item.id === memoryId);
  if (!memory) {
    throw new Error("Memory not found");
  }

  const sourceId = resolveMemorySourceId(memory);

  let relationsData = await fetchGraphRelationsForSource(userId, sourceId, true);
  let graph = buildGraphFromRelations(relationsData);

  if (graph.entityCount === 0) {
    relationsData = await fetchGraphRelationsForSource(userId, sourceId, false);
    graph = buildGraphFromRelations(relationsData);
  }

  return {
    memoryId: memory.id,
    title: memory.title,
    sourceId,
    graph,
  };
}
