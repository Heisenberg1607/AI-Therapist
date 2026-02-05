"use client";

import { useState } from "react";
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
  Mail,
  Clock,
  Star,
  Navigation,
  Search,
  Filter,
  Users,
  Heart,
  Brain,
  Stethoscope,
} from "lucide-react";

export default function ClinicsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [sortBy, setSortBy] = useState("distance");

  const clinics = [
    {
      id: 1,
      name: "Mindful Wellness Center",
      address: "123 Therapy Lane, Downtown",
      distance: "0.8 miles",
      phone: "(555) 123-4567",
      email: "info@mindfulwellness.com",
      rating: 4.8,
      reviews: 127,
      specialties: ["Anxiety", "Depression", "PTSD"],
      hours: "Mon-Fri 8AM-6PM",
      acceptingPatients: true,
      type: "Private Practice",
    },
    {
      id: 2,
      name: "Community Mental Health Clinic",
      address: "456 Health St, Midtown",
      distance: "1.2 miles",
      phone: "(555) 234-5678",
      email: "contact@cmhc.org",
      rating: 4.5,
      reviews: 89,
      specialties: ["Addiction", "Family Therapy", "Group Sessions"],
      hours: "Mon-Sat 7AM-8PM",
      acceptingPatients: true,
      type: "Community Center",
    },
    {
      id: 3,
      name: "Serenity Behavioral Health",
      address: "789 Peace Ave, Uptown",
      distance: "2.1 miles",
      phone: "(555) 345-6789",
      email: "hello@serenitybh.com",
      rating: 4.9,
      reviews: 203,
      specialties: ["Trauma", "Couples Therapy", "Child Psychology"],
      hours: "Mon-Fri 9AM-7PM",
      acceptingPatients: false,
      type: "Specialized Clinic",
    },
    {
      id: 4,
      name: "Riverside Psychiatric Hospital",
      address: "321 River Rd, Riverside",
      distance: "3.5 miles",
      phone: "(555) 456-7890",
      email: "admissions@riverside.med",
      rating: 4.3,
      reviews: 156,
      specialties: [
        "Inpatient Care",
        "Crisis Intervention",
        "Medication Management",
      ],
      hours: "24/7 Emergency Services",
      acceptingPatients: true,
      type: "Hospital",
    },
    {
      id: 5,
      name: "Harmony Counseling Services",
      address: "654 Wellness Blvd, Suburbs",
      distance: "4.2 miles",
      phone: "(555) 567-8901",
      email: "info@harmonycounseling.com",
      rating: 4.6,
      reviews: 94,
      specialties: ["Teen Counseling", "Eating Disorders", "Life Coaching"],
      hours: "Tue-Sat 10AM-6PM",
      acceptingPatients: true,
      type: "Private Practice",
    },
  ];

  const specialties = [
    "Anxiety",
    "Depression",
    "PTSD",
    "Addiction",
    "Family Therapy",
    "Trauma",
    "Child Psychology",
  ];

  const getSpecialtyIcon = (specialty: string) => {
    switch (specialty.toLowerCase()) {
      case "anxiety":
      case "depression":
      case "ptsd":
        return <Brain className="h-4 w-4" />;
      case "addiction":
        return <Heart className="h-4 w-4" />;
      case "family therapy":
      case "couples therapy":
        return <Users className="h-4 w-4" />;
      default:
        return <Stethoscope className="h-4 w-4" />;
    }
  };

  const filteredClinics = clinics.filter((clinic) => {
    const matchesSearch =
      clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clinic.specialties.some((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesSpecialty =
      filterSpecialty === "all" ||
      clinic.specialties.some((s) =>
        s.toLowerCase().includes(filterSpecialty.toLowerCase())
      );
    return matchesSearch && matchesSpecialty;
  });

  return (
    <div className="p-8 mt-10">
      

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
        <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
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
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40  border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className=" border-gray-700">
            <SelectItem value="distance">Distance</SelectItem>
            <SelectItem value="rating">Rating</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map View */}
        <div className="lg:col-span-1">
          <Card className=" border-gray-800 sticky top-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-green-500" />
                Map View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-400">Interactive map would be here</p>
                  <p className="text-sm text-gray-500">
                    Showing {filteredClinics.length} nearby clinics
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Total Clinics</span>
                  <span className="text-white">{filteredClinics.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Accepting Patients</span>
                  <span className="text-green-500">
                    {filteredClinics.filter((c) => c.acceptingPatients).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Average Rating</span>
                  <span className="text-white">
                    {(
                      filteredClinics.reduce((acc, c) => acc + c.rating, 0) /
                      filteredClinics.length
                    ).toFixed(1)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clinics List */}
        <div className="lg:col-span-2 space-y-6">
          {filteredClinics.map((clinic) => (
            <Card key={clinic.id} className=" border-gray-800">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center">
                      {clinic.name}
                      {clinic.acceptingPatients && (
                        <Badge className="ml-2 bg-green-500 text-black">
                          Accepting Patients
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-gray-400 mt-1">
                      <MapPin className="h-4 w-4 inline mr-1" />
                      {clinic.address} • {clinic.distance}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      <span className="text-white font-medium">
                        {clinic.rating}
                      </span>
                      <span className="text-gray-400 text-sm ml-1">
                        ({clinic.reviews})
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="mt-1 border-gray-600 text-gray-300"
                    >
                      {clinic.type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-white font-medium mb-3">Specialties</h4>
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
                      <div className="flex items-center text-gray-300">
                        <Phone className="h-4 w-4 mr-2 text-green-500" />
                        <span className="text-sm">{clinic.phone}</span>
                      </div>
                      <div className="flex items-center text-gray-300">
                        <Mail className="h-4 w-4 mr-2 text-green-500" />
                        <span className="text-sm">{clinic.email}</span>
                      </div>
                      <div className="flex items-center text-gray-300">
                        <Clock className="h-4 w-4 mr-2 text-green-500" />
                        <span className="text-sm">{clinic.hours}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
                  <div className="flex space-x-3">
                    <Button
                      size="sm"
                      className="bg-green-500 hover:bg-green-600 text-black"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-black bg-transparent"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Get Directions
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
