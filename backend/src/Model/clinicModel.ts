import { prisma } from "../prisma/prismaClient";

// Shape returned to the frontend. `distanceM` is null when the caller didn't
// provide a location (we fall back to an alphabetical list so the page still
// renders). rating/reviews/hours come straight from the DB and are NULL for
// gov-sourced rows — the UI hides them when absent.
export interface ClinicRow {
  id: string;
  name: string;
  npi: string | null;
  source: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  type: string | null;
  specialties: string[];
  description: string | null;
  lat: number | null;
  lng: number | null;
  accepting_patients: boolean | null;
  rating: number | null;
  reviews: number | null;
  hours: string | null;
  distanceM: number | null;
}

export interface NearbyParams {
  lat?: number;
  lng?: number;
  radiusM?: number;
  page?: number;
  pageSize?: number;
  q?: string;
  specialty?: string;
  sort?: "distance" | "name";
}

export interface ClinicPage {
  clinics: ClinicRow[];
  total: number;
}

// Columns shared by both query branches (keeps the return shape identical).
const COLS = `
  id, name, npi, source, address, city, state, zip, phone, website,
  type, specialties, description, lat, lng,
  accepting_patients, rating, reviews, hours`;

// `total` rides along on each row via a window count, then is stripped off.
type RawRow = ClinicRow & { total: number };

function split(rows: RawRow[]): ClinicPage {
  const total = rows[0]?.total ?? 0;
  const clinics = rows.map(({ total: _t, ...rest }) => rest);
  return { clinics, total };
}

/**
 * Find clinics, one page at a time (server-side pagination).
 *
 * When lat/lng are given, returns clinics within `radiusM` ranked by distance;
 * otherwise an alphabetical list. `q` filters by name or specialty, `specialty`
 * narrows to a specialty tag, `sort` chooses the ordering. `total` is the full
 * match count (across all pages) so the UI can render page controls.
 */
export async function getNearbyClinics(params: NearbyParams): Promise<ClinicPage> {
  const { lat, lng } = params;
  const radiusM = params.radiusM ?? 40000;
  const pageSize = Math.min(Math.max(params.pageSize ?? 7, 1), 50);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const qLike = params.q?.trim() ? `%${params.q.trim()}%` : null;
  const specLike = params.specialty?.trim() ? `%${params.specialty.trim()}%` : null;
  const byName = params.sort === "name";

  if (lat != null && lng != null) {
    const order = byName
      ? "c.name"
      : "extensions.st_distance(c.geom, u.g)";
    const rows = await prisma.$queryRawUnsafe<RawRow[]>(
      `
      with u as (
        select extensions.st_setsrid(
                 extensions.st_makepoint($2::float8, $1::float8), 4326
               )::extensions.geography g
      )
      select ${COLS},
             round(extensions.st_distance(c.geom, u.g))::int as "distanceM",
             count(*) over()::int as total
      from "Clinic" c, u
      where c.geom is not null
        and extensions.st_dwithin(c.geom, u.g, $3::float8)
        and (
          $4::text is null
          or c.name ilike $4
          or exists (select 1 from unnest(c.specialties) s where s ilike $4)
        )
        and (
          $5::text is null
          or exists (select 1 from unnest(c.specialties) s where s ilike $5)
        )
      order by ${order}
      offset $6::int limit $7::int
      `,
      lat,
      lng,
      radiusM,
      qLike,
      specLike,
      offset,
      pageSize,
    );
    return split(rows);
  }

  // Fallback: no location supplied — always alphabetical.
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `
    select ${COLS}, null::int as "distanceM",
           count(*) over()::int as total
    from "Clinic" c
    where (
      $1::text is null
      or c.name ilike $1
      or exists (select 1 from unnest(c.specialties) s where s ilike $1)
    )
    and (
      $2::text is null
      or exists (select 1 from unnest(c.specialties) s where s ilike $2)
    )
    order by c.name
    offset $3::int limit $4::int
    `,
    qLike,
    specLike,
    offset,
    pageSize,
  );
  return split(rows);
}
