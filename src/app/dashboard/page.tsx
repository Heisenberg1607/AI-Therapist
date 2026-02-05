"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Clock,
  TrendingUp,
  Users,
  MessageSquare,
  Heart,
  Activity,
  BarChart3,
  User,
} from "lucide-react";

export default function OverviewPage() {
  const stats = {
    totalSessions: 127,
    activeClients: 23,
    avgSessionLength: 42,
    completionRate: 89,
  };

  const recentSessions = [
    {
      id: 1,
      client: "Atharva K.",
      initials: "AK",
      date: "Today, 2:30 PM",
      duration: 45,
      mood: "Positive",
      status: "completed",
    },
    {
      id: 2,
      client: "Sarah M.",
      initials: "SM",
      date: "Today, 11:00 AM",
      duration: 38,
      mood: "Neutral",
      status: "completed",
    },
    {
      id: 3,
      client: "John D.",
      initials: "JD",
      date: "Yesterday, 4:15 PM",
      duration: 52,
      mood: "Improving",
      status: "completed",
    },
    {
      id: 4,
      client: "Emma L.",
      initials: "EL",
      date: "Yesterday, 1:00 PM",
      duration: 41,
      mood: "Challenging",
      status: "needs-followup",
    },
  ];

  const upcomingSessions = [
    {
      id: 1,
      client: "Michael R.",
      initials: "MR",
      time: "3:00 PM",
      type: "Initial Consultation",
    },
    {
      id: 2,
      client: "Lisa K.",
      initials: "LK",
      time: "4:30 PM",
      type: "Follow-up Session",
    },
  ];

  return (
    <div className="p-8 mt-10">
      

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className=" border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Total Sessions
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.totalSessions}
            </div>
            <p className="text-xs text-green-500">+12% from last month</p>
          </CardContent>
        </Card>

        <Card className=" border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Active Clients
            </CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.activeClients}
            </div>
            <p className="text-xs text-green-500">+3 new this week</p>
          </CardContent>
        </Card>

        <Card className=" border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Avg Session Length
            </CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.avgSessionLength}m
            </div>
            <p className="text-xs text-gray-400">Optimal range</p>
          </CardContent>
        </Card>

        <Card className=" border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Completion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.completionRate}%
            </div>
            <p className="text-xs text-green-500">Above average</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Sessions */}
          <Card className=" border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Activity className="h-5 w-5 mr-2 text-green-500" />
                Recent Sessions
              </CardTitle>
              <CardDescription className="text-gray-400">
                Latest therapy sessions and client interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-800 border border-gray-700"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-green-500 text-black font-semibold">
                          {session.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-white">
                          {session.client}
                        </p>
                        <p className="text-sm text-gray-400">{session.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm text-white">
                          {session.duration}min
                        </p>
                        <Badge
                          variant={
                            session.mood === "Positive"
                              ? "default"
                              : session.mood === "Challenging"
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            session.mood === "Positive"
                              ? "bg-green-500 text-black"
                              : ""
                          }
                        >
                          {session.mood}
                        </Badge>
                      </div>
                      {session.status === "needs-followup" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-yellow-500 text-yellow-500 bg-transparent"
                        >
                          Follow-up
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Analytics Chart Placeholder */}
          <Card className=" border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
                Session Analytics
              </CardTitle>
              <CardDescription className="text-gray-400">
                Weekly session trends and client progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-800 rounded-lg border border-gray-700">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-400">
                    Analytics chart would be displayed here
                  </p>
                  <p className="text-sm text-gray-500">
                    Integration with charting library needed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Today's Schedule */}
          <Card className=" border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-green-500" />
                Today Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center space-x-3 p-3 rounded-lg bg-gray-800 border border-gray-700"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-green-500 text-black text-sm font-semibold">
                        {session.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-white text-sm">
                        {session.client}
                      </p>
                      <p className="text-xs text-gray-400">{session.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-500 font-medium">
                        {session.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4 bg-green-500 hover:bg-green-600 text-black">
                View Full Schedule
              </Button>
            </CardContent>
          </Card>

          {/* Client Progress */}
          <Card className=" border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Heart className="h-5 w-5 mr-2 text-green-500" />
                Client Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Overall Improvement</span>
                    <span className="text-green-500">78%</span>
                  </div>
                  <Progress value={78} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Session Engagement</span>
                    <span className="text-green-500">92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Goal Achievement</span>
                    <span className="text-green-500">65%</span>
                  </div>
                  <Progress value={65} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className=" border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button className="w-full bg-green-500 hover:bg-green-600 text-black">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start Emergency Session
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                >
                  <User className="h-4 w-4 mr-2" />
                  Add New Client
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
