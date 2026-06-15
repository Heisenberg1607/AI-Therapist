/**
 * Seed the "Clinic" table with California behavioral-health facilities.
 *
 * Source pipeline (gov / open data, no API keys required):
 *   1. NPPES NPI Registry  — CA organization (NPI-2) providers filtered by
 *      behavioral-health taxonomy descriptions. Authoritative, free, no auth.
 *   2. US Census batch geocoder — turns each mailing address into lat/lng (free).
 *   3. Upsert into Postgres via Prisma raw SQL, backfilling the PostGIS `geom`
 *      column from lat/lng.
 *
 * Semantic-search embeddings are intentionally left NULL here — the column +
 * HNSW index already exist, so they can be backfilled in a later pass without
 * touching this script.
 *
 * Run:  npx ts-node src/scripts/seedClinics.ts
 * Tune: CLINIC_MAX (default 1500) caps how many unique clinics are seeded.
 */

// Load .env before anything constructs the Prisma client (which reads
// DATABASE_URL at import time). Must stay the first import.
import "dotenv/config";
import { prisma } from "../prisma/prismaClient";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NPPES_URL = "https://npiregistry.cms.hhs.gov/api/";
const CENSUS_BATCH_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";

const STATE = "CA";
const CLINIC_MAX = Number(process.env.CLINIC_MAX ?? 1500);
const NPPES_PAGE = 200; // NPPES hard max per request
const NPPES_MAX_SKIP = 1000; // NPPES hard max skip
const GEOCODE_CHUNK = 5000; // Census batch hard max is 10k/file

// NUCC taxonomy descriptions that map to behavioral-health facilities.
// (Validated against the live NPPES API — invalid ones are skipped gracefully.)
const TAXONOMIES = [
  "Community/Behavioral Health",
  "Counselor",
  "Psychologist",
  "Marriage & Family Therapist",
  "Social Worker",
  "Psychiatry & Neurology",
  "Clinical Neuropsychologist",
  "Behavior Analyst",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Clinic {
  npi: string;
  name: string;
  source: "NPPES";
  address: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  phone: string | null;
  type: string | null; // primary taxonomy
  specialties: string[]; // all taxonomy descriptions
  description: string;
  lat: number | null;
  lng: number | null;
}

// ---------------------------------------------------------------------------
// 1. Fetch from NPPES
// ---------------------------------------------------------------------------

async function fetchNppes(): Promise<Map<string, Clinic>> {
  const byNpi = new Map<string, Clinic>();

  for (const taxonomy of TAXONOMIES) {
    if (byNpi.size >= CLINIC_MAX) break;

    for (let skip = 0; skip <= NPPES_MAX_SKIP; skip += NPPES_PAGE) {
      if (byNpi.size >= CLINIC_MAX) break;

      const url =
        `${NPPES_URL}?version=2.1&enumeration_type=NPI-2&state=${STATE}` +
        `&taxonomy_description=${encodeURIComponent(taxonomy)}` +
        `&limit=${NPPES_PAGE}&skip=${skip}`;

      let json: any;
      try {
        const res = await fetch(url);
        json = await res.json();
      } catch (err) {
        console.warn(`  NPPES fetch failed (${taxonomy}, skip=${skip}):`, err);
        break;
      }

      if (json.Errors) {
        console.warn(`  Skipping taxonomy "${taxonomy}": ${json.Errors[0]?.description}`);
        break;
      }

      const results: any[] = json.results ?? [];
      if (results.length === 0) break;

      for (const r of results) {
        const npi = String(r.number);
        const name: string | undefined = r.basic?.organization_name;
        if (!name) continue;

        const loc =
          (r.addresses ?? []).find((a: any) => a.address_purpose === "LOCATION") ??
          r.addresses?.[0];

        // NPPES's state= filter matches the *mailing* address, so a CA-registered
        // org can have an out-of-state practice location. Keep only CA locations —
        // anything else would pollute the geo search.
        if (loc?.state && loc.state !== STATE) continue;

        const taxes: any[] = r.taxonomies ?? [];
        const descs = Array.from(
          new Set(taxes.map((t) => t.desc).filter(Boolean)),
        ) as string[];
        const primary = taxes.find((t) => t.primary)?.desc ?? descs[0] ?? null;

        const city = loc?.city ?? null;
        const street = [loc?.address_1, loc?.address_2]
          .filter(Boolean)
          .join(" ")
          .trim() || null;

        const existing = byNpi.get(npi);
        if (existing) {
          // Same facility surfaced under another taxonomy — merge specialties.
          existing.specialties = Array.from(
            new Set([...existing.specialties, ...descs]),
          );
          continue;
        }

        byNpi.set(npi, {
          npi,
          name: titleCase(name),
          source: "NPPES",
          address: street,
          city: city ? titleCase(city) : null,
          state: loc?.state ?? STATE,
          zip: loc?.postal_code ? String(loc.postal_code).slice(0, 5) : null,
          phone: loc?.telephone_number ?? null,
          type: primary,
          specialties: descs,
          description: buildDescription(titleCase(name), primary, descs, city),
          lat: null,
          lng: null,
        });
      }

      if (results.length < NPPES_PAGE) break; // last page for this taxonomy
    }

    console.log(`  …after "${taxonomy}": ${byNpi.size} unique clinics`);
  }

  return byNpi;
}

function buildDescription(
  name: string,
  type: string | null,
  specialties: string[],
  city: string | null,
): string {
  const where = city ? ` in ${titleCase(city)}, CA` : " in CA";
  const kind = type ? ` (${type})` : "";
  const svc = specialties.length ? ` Services: ${specialties.join(", ")}.` : "";
  return `${name}${kind}${where}.${svc}`.trim();
}

// NPPES stores names/cities in ALL CAPS; render them readable.
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Llc|Inc|Pc|Pllc|Mft|Lcsw)\b/g, (m) => m.toUpperCase());
}

// ---------------------------------------------------------------------------
// 2. Geocode via US Census batch geocoder
// ---------------------------------------------------------------------------

async function geocode(clinics: Clinic[]): Promise<void> {
  const geocodable = clinics.filter((c) => c.address && c.city);
  console.log(`Geocoding ${geocodable.length} addresses via US Census…`);

  for (let i = 0; i < geocodable.length; i += GEOCODE_CHUNK) {
    const chunk = geocodable.slice(i, i + GEOCODE_CHUNK);

    // CSV columns (no header): id, street, city, state, zip
    const csv = chunk
      .map((c) =>
        [c.npi, c.address, c.city, c.state, c.zip ?? ""]
          .map((f) => String(f ?? "").replace(/[,"]/g, " ").trim())
          .join(","),
      )
      .join("\n");

    const form = new FormData();
    form.append("benchmark", "Public_AR_Current");
    form.append(
      "addressFile",
      new Blob([csv], { type: "text/csv" }),
      "addresses.csv",
    );

    let text: string;
    try {
      const res = await fetch(CENSUS_BATCH_URL, { method: "POST", body: form });
      text = await res.text();
    } catch (err) {
      console.warn(`  Census batch failed for chunk @${i}:`, err);
      continue;
    }

    const coords = parseCensusResponse(text);
    let matched = 0;
    for (const c of chunk) {
      const hit = coords.get(c.npi);
      if (hit) {
        c.lat = hit.lat;
        c.lng = hit.lng;
        matched++;
      }
    }
    console.log(`  chunk @${i}: matched ${matched}/${chunk.length}`);
  }
}

// Census returns quoted CSV; the coordinates field is "lng,lat".
//   id,"input addr","Match","Exact","matched addr","lng,lat",tigerId,side
function parseCensusResponse(text: string): Map<string, { lat: number; lng: number }> {
  const out = new Map<string, { lat: number; lng: number }>();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    const id = fields[0];
    const match = fields[2];
    if (id && match === "Match" && fields[5]) {
      const [lng, lat] = fields[5].split(",").map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        out.set(id, { lat, lng });
      }
    }
  }
  return out;
}

// Minimal quote-aware CSV line parser.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

// ---------------------------------------------------------------------------
// 3. Upsert into Postgres (Prisma raw SQL; backfills PostGIS geom)
// ---------------------------------------------------------------------------

// Build a Postgres text[] literal: ["a","b"] -> '{"a","b"}'
function pgTextArray(arr: string[]): string {
  return `{${arr
    .map((s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",")}}`;
}

const UPSERT_SQL = `
INSERT INTO "Clinic"
  (name, npi, source, address, city, state, zip, phone, type, specialties, description, website, lat, lng, geom)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11, $12, $13::float8, $14::float8,
   CASE WHEN $13::float8 IS NULL OR $14::float8 IS NULL THEN NULL
        ELSE extensions.st_setsrid(extensions.st_makepoint($14::float8, $13::float8), 4326)::extensions.geography
   END)
ON CONFLICT (npi) DO UPDATE SET
  name = EXCLUDED.name, source = EXCLUDED.source, address = EXCLUDED.address,
  city = EXCLUDED.city, state = EXCLUDED.state, zip = EXCLUDED.zip,
  phone = EXCLUDED.phone, type = EXCLUDED.type, specialties = EXCLUDED.specialties,
  description = EXCLUDED.description, website = EXCLUDED.website,
  lat = EXCLUDED.lat, lng = EXCLUDED.lng, geom = EXCLUDED.geom, updated_at = now()
`;

async function upsert(clinics: Clinic[]): Promise<number> {
  let n = 0;
  for (const c of clinics) {
    await prisma.$executeRawUnsafe(
      UPSERT_SQL,
      c.name,
      c.npi,
      c.source,
      c.address,
      c.city,
      c.state,
      c.zip,
      c.phone,
      c.type,
      pgTextArray(c.specialties),
      c.description,
      null, // website (not provided by NPPES)
      c.lat,
      c.lng,
    );
    n++;
    if (n % 100 === 0) console.log(`  upserted ${n}/${clinics.length}…`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding up to ${CLINIC_MAX} CA behavioral-health clinics…\n`);

  console.log("1) Fetching from NPPES NPI Registry…");
  const byNpi = await fetchNppes();
  const clinics = Array.from(byNpi.values()).slice(0, CLINIC_MAX);
  console.log(`   collected ${clinics.length} unique clinics\n`);

  console.log("2) Geocoding addresses (US Census)…");
  await geocode(clinics);
  const located = clinics.filter((c) => c.lat != null).length;
  console.log(`   geocoded ${located}/${clinics.length}\n`);

  console.log("3) Upserting into Clinic table…");
  const written = await upsert(clinics);
  console.log(`\nDone. Upserted ${written} clinics (${located} with coordinates).`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
