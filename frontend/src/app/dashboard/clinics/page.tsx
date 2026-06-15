"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Phone,
  Clock,
  Star,
  Navigation,
  Search,
  Filter,
  Users,
  Heart,
  Brain,
  Stethoscope,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getClinicsApi, type Clinic } from "@/app/lib/api";

// Specialty quick-filter options (substring match against clinic specialties).
const specialties = [
  "Behavioral Health",
  "Counselor",
  "Psychologist",
  "Marriage & Family",
  "Social Worker",
  "Substance",
  "Mental Health",
];

const milesFrom = (distanceM: number | null): string | null =>
  distanceM == null ? null : `${(distanceM / 1609.34).toFixed(1)} miles`;

// Page numbers to render, windowed around the current page with ellipses.
function pageWindow(current: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < totalPages - 1) out.push("…");
  out.push(totalPages);
  return out;
}

export default function ClinicsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [sortBy, setSortBy] = useState<"distance" | "name">("distance");

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  // Geolocation resolves once; we keep the coords so page/filter changes refetch
  // against the same origin. `coordsResolved` gates fetching until we know
  // whether the browser granted a location.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsResolved, setCoordsResolved] = useState(false);

  // Resolve location once on mount.
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setCoordsResolved(true);
        },
        () => {
          setLocationNote(
            "Location off — showing clinics alphabetically. Enable location for nearest-first results.",
          );
          setCoordsResolved(true);
        },
        { timeout: 8000 },
      );
    } else {
      setLocationNote("Location unavailable — showing clinics alphabetically.");
      setCoordsResolved(true);
    }
  }, []);

  // Debounce the search box; a new query resets to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Fetch a page whenever the query, filters, sort, page, or coords change.
  useEffect(() => {
    if (!coordsResolved) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getClinicsApi({
      lat: coords?.lat,
      lng: coords?.lng,
      q: debouncedQuery || undefined,
      specialty: filterSpecialty === "all" ? undefined : filterSpecialty,
      sort: sortBy,
      page,
    })
      .then((res) => {
        if (cancelled) return;
        setClinics(res.clinics);
        setTotal(res.total);
        setPageSize(res.pageSize);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load clinics. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [coordsResolved, coords, debouncedQuery, filterSpecialty, sortBy, page]);

  const getSpecialtyIcon = (specialty: string) => {
    const s = specialty.toLowerCase();
    if (s.includes("psych") || s.includes("mental") || s.includes("behavioral"))
      return <Brain className="h-4 w-4" />;
    if (s.includes("substance") || s.includes("addiction"))
      return <Heart className="h-4 w-4" />;
    if (s.includes("family") || s.includes("marriage") || s.includes("social"))
      return <Users className="h-4 w-4" />;
    return <Stethoscope className="h-4 w-4" />;
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="p-8 mt-10 max-w-4xl mx-auto">
      {locationNote && (
        <p className="text-sm text-yellow-500/80 mb-4">{locationNote}</p>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search clinics or specialties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10  border-gray-700 text-white"
          />
        </div>
        <Select
          value={filterSpecialty}
          onValueChange={(v) => {
            setFilterSpecialty(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48  border-gray-700 text-white">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by specialty" />
          </SelectTrigger>
          <SelectContent className=" border-gray-700">
            <SelectItem value="all">All Specialties</SelectItem>
            {specialties.map((specialty) => (
              <SelectItem key={specialty} value={specialty.toLowerCase()}>
                {specialty}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(v) => {
            setSortBy(v as "distance" | "name");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40  border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className=" border-gray-700">
            <SelectItem value="distance">Distance</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Result count */}
      {!loading && !error && total > 0 && (
        <p className="text-sm text-gray-400 mb-4">
          Showing {rangeStart}–{rangeEnd} of {total} clinics
        </p>
      )}

      {/* Clinics List */}
      <div className="space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Finding clinics near you…
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-20 text-red-400">{error}</div>
        )}

        {!loading && !error && clinics.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            No clinics match your search.
          </div>
        )}

        {!loading &&
          !error &&
          clinics.map((clinic) => {
            const distance = milesFrom(clinic.distanceM);
            return (
              <Card key={clinic.id} className=" border-gray-800">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center">
                        {clinic.name}
                        {clinic.accepting_patients === true && (
                          <Badge className="ml-2 bg-green-500 text-black">
                            Accepting Patients
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-gray-400 mt-1">
                        <MapPin className="h-4 w-4 inline mr-1" />
                        {[clinic.address, clinic.city]
                          .filter(Boolean)
                          .join(", ")}
                        {distance && ` • ${distance}`}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      {clinic.rating != null && (
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-500 mr-1" />
                          <span className="text-white font-medium">
                            {clinic.rating}
                          </span>
                          {clinic.reviews != null && (
                            <span className="text-gray-400 text-sm ml-1">
                              ({clinic.reviews})
                            </span>
                          )}
                        </div>
                      )}
                      {clinic.type && (
                        <Badge
                          variant="outline"
                          className="mt-1 border-gray-600 text-gray-300"
                        >
                          {clinic.type}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-white font-medium mb-3">
                        Specialties
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {clinic.specialties.map((specialty, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-gray-800 text-gray-300 border border-gray-700"
                          >
                            {getSpecialtyIcon(specialty)}
                            <span className="ml-1">{specialty}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-3">
                        Contact Information
                      </h4>
                      <div className="space-y-2">
                        {clinic.phone && (
                          <div className="flex items-center text-gray-300">
                            <Phone className="h-4 w-4 mr-2 text-green-500" />
                            <span className="text-sm">{clinic.phone}</span>
                          </div>
                        )}
                        {clinic.hours && (
                          <div className="flex items-center text-gray-300">
                            <Clock className="h-4 w-4 mr-2 text-green-500" />
                            <span className="text-sm">{clinic.hours}</span>
                          </div>
                        )}
                        {clinic.zip && (
                          <div className="flex items-center text-gray-300">
                            <MapPin className="h-4 w-4 mr-2 text-green-500" />
                            <span className="text-sm">
                              {clinic.city}, {clinic.state} {clinic.zip}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
                    <div className="flex space-x-3">
                      {clinic.phone && (
                        <a href={`tel:${clinic.phone}`}>
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-black"
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </Button>
                        </a>
                      )}
                    </div>
                    {clinic.lat != null && clinic.lng != null && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-black bg-transparent"
                        >
                          <Navigation className="h-4 w-4 mr-2" />
                          Get Directions
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <Button
            size="sm"
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>

          {pageWindow(page, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-2 text-gray-500">
                …
              </span>
            ) : (
              <Button
                key={p}
                size="sm"
                variant="outline"
                onClick={() => goToPage(p)}
                className={
                  p === page
                    ? "bg-green-500 text-black border-green-500 hover:bg-green-600"
                    : "border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent"
                }
              >
                {p}
              </Button>
            ),
          )}

          <Button
            size="sm"
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
