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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Target,
} from "lucide-react";

export default function ReportsPage() {
  const [timeRange, setTimeRange] = useState("month");

  const reportStats = {
    totalSessions: 127,
    completedSessions: 114,
    cancelledSessions: 13,
    avgSessionRating: 4.7,
    clientRetention: 89,
    responseTime: 2.3,
  };



  const topIssues = [
    { issue: "Work Anxiety", sessions: 34, percentage: 27 },
    { issue: "Relationship Issues", sessions: 28, percentage: 22 },
    { issue: "Sleep Disorders", sessions: 25, percentage: 20 },
    { issue: "Depression", sessions: 19, percentage: 15 },
    { issue: "Stress Management", sessions: 16, percentage: 13 },
    { issue: "Other", sessions: 5, percentage: 4 },
  ];

  const clientProgress = [
    { name: "Sarah M.", improvement: 85, sessions: 12, status: "Excellent" },
    { name: "John D.", improvement: 72, sessions: 8, status: "Good" },
    { name: "Emma L.", improvement: 45, sessions: 15, status: "Moderate" },
    { name: "Michael R.", improvement: 91, sessions: 6, status: "Excellent" },
    { name: "Lisa K.", improvement: 68, sessions: 10, status: "Good" },
  ];

  return (
    <div className="p-8 mt-10">
      <div className="flex items-center justify-between mb-8">
        
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-green-500 hover:bg-green-600 text-black">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Session Completion Rate
            </CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {Math.round(
                (reportStats.completedSessions / reportStats.totalSessions) *
                  100
              )}
              %
            </div>
            <p className="text-xs text-green-500 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              +5% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Average Session Rating
            </CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {reportStats.avgSessionRating}/5.0
            </div>
            <p className="text-xs text-green-500 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              +0.2 from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Client Retention
            </CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {reportStats.clientRetention}%
            </div>
            <p className="text-xs text-red-400 flex items-center">
              <TrendingDown className="h-3 w-3 mr-1" />
              -2% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Session Trends */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
              Session Trends
            </CardTitle>
            <CardDescription className="text-gray-400">
              Monthly session volume and satisfaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center bg-gray-800 rounded-lg border border-gray-700 mb-4">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-400">Session trends chart</p>
                <p className="text-sm text-gray-500">
                  Chart visualization would be here
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-500">67</p>
                <p className="text-xs text-gray-400">This Month</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">4.9</p>
                <p className="text-xs text-gray-400">Avg Rating</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">+15%</p>
                <p className="text-xs text-gray-400">Growth</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Issues */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-green-500" />
              Most Common Issues
            </CardTitle>
            <CardDescription className="text-gray-400">
              Distribution of therapy topics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topIssues.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-white text-sm">{item.issue}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-24">
                      <Progress value={item.percentage} className="h-2" />
                    </div>
                    <span className="text-gray-400 text-sm w-12">
                      {item.sessions}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Progress Report */}
      <Card className="bg-gray-900 border-gray-800 mb-8">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
            Client Progress Report
          </CardTitle>
          <CardDescription className="text-gray-400">
            Individual client improvement tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {clientProgress.map((client, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-800 border border-gray-700"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-black font-semibold">
                    {client.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="font-medium text-white">{client.name}</p>
                    <p className="text-sm text-gray-400">
                      {client.sessions} sessions completed
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-32">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-green-500">
                        {client.improvement}%
                      </span>
                    </div>
                    <Progress value={client.improvement} className="h-2" />
                  </div>
                  <Badge
                    variant={
                      client.status === "Excellent"
                        ? "default"
                        : client.status === "Good"
                        ? "secondary"
                        : "outline"
                    }
                    className={
                      client.status === "Excellent"
                        ? "bg-green-500 text-black"
                        : ""
                    }
                  >
                    {client.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Report Actions */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <FileText className="h-5 w-5 mr-2 text-green-500" />
            Generate Custom Reports
          </CardTitle>
          <CardDescription className="text-gray-400">
            Create detailed reports for specific needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Monthly Summary
            </Button>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
            >
              <Users className="h-4 w-4 mr-2" />
              Client Progress Report
            </Button>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
            >
              <Clock className="h-4 w-4 mr-2" />
              Session Analytics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
