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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Target,
  Activity,
  Brain,
  Heart,
  Zap,
  CheckCircle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7d");
  const [activeTab, setActiveTab] = useState("overview");

  const realTimeMetrics = {
    activeSessions: 3,
    avgResponseTime: 1.2,
    systemUptime: 99.8,
    clientSatisfaction: 4.7,
  };

  const performanceMetrics = [
    { metric: "Session Completion Rate", value: 94, change: +5, trend: "up" },
    { metric: "Client Retention Rate", value: 87, change: -2, trend: "down" },
    { metric: "Average Session Duration", value: 42, change: +3, trend: "up" },
    { metric: "Response Accuracy", value: 91, change: +7, trend: "up" },
    { metric: "Client Engagement Score", value: 78, change: +12, trend: "up" },
    {
      metric: "Crisis Intervention Success",
      value: 96,
      change: +1,
      trend: "up",
    },
  ];

  const clientEngagement = [
    { timeSlot: "9:00 AM", sessions: 12, satisfaction: 4.8 },
    { timeSlot: "11:00 AM", sessions: 18, satisfaction: 4.6 },
    { timeSlot: "1:00 PM", sessions: 15, satisfaction: 4.7 },
    { timeSlot: "3:00 PM", sessions: 22, satisfaction: 4.9 },
    { timeSlot: "5:00 PM", sessions: 19, satisfaction: 4.5 },
    { timeSlot: "7:00 PM", sessions: 8, satisfaction: 4.4 },
  ];

  const sessionEffectiveness = [
    {
      category: "Anxiety Management",
      sessions: 45,
      improvement: 82,
      avgDuration: 38,
    },
    {
      category: "Depression Support",
      sessions: 38,
      improvement: 76,
      avgDuration: 44,
    },
    {
      category: "Stress Relief",
      sessions: 32,
      improvement: 88,
      avgDuration: 35,
    },
    {
      category: "Relationship Issues",
      sessions: 28,
      improvement: 71,
      avgDuration: 48,
    },
    {
      category: "Sleep Disorders",
      sessions: 22,
      improvement: 79,
      avgDuration: 41,
    },
  ];

  const predictiveInsights = [
    {
      insight: "Peak session demand expected between 3-5 PM this week",
      confidence: 89,
      type: "scheduling",
      action: "Consider increasing availability",
    },
    {
      insight:
        "Client retention likely to improve by 8% with follow-up reminders",
      confidence: 76,
      type: "retention",
      action: "Implement automated follow-ups",
    },
    {
      insight: "Anxiety-related sessions show 15% better outcomes on weekdays",
      confidence: 92,
      type: "effectiveness",
      action: "Optimize scheduling patterns",
    },
  ];

  return (
    <div className="p-8 mt-10">
      <div className="flex items-center justify-between mb-8">
        
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32 bg-gray-900 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            <SelectItem value="24h">24 Hours</SelectItem>
            <SelectItem value="7d">7 Days</SelectItem>
            <SelectItem value="30d">30 Days</SelectItem>
            <SelectItem value="90d">90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Active Sessions
            </CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {realTimeMetrics.activeSessions}
            </div>
            <p className="text-xs text-green-500">Live now</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Avg Response Time
            </CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {realTimeMetrics.avgResponseTime}s
            </div>
            <p className="text-xs text-green-500">Excellent</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              System Uptime
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {realTimeMetrics.systemUptime}%
            </div>
            <p className="text-xs text-green-500">Stable</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">
              Client Satisfaction
            </CardTitle>
            <Heart className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {realTimeMetrics.clientSatisfaction}/5.0
            </div>
            <p className="text-xs text-green-500">Above target</p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            Performance
          </TabsTrigger>
          <TabsTrigger
            value="engagement"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            Engagement
          </TabsTrigger>
          <TabsTrigger
            value="insights"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-green-500" />
                  Performance Overview
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Key performance indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceMetrics.slice(0, 3).map((metric, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <span className="text-gray-300 text-sm">
                        {metric.metric}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium">
                          {metric.value}%
                        </span>
                        <div
                          className={`flex items-center ${
                            metric.trend === "up"
                              ? "text-green-500"
                              : "text-red-400"
                          }`}
                        >
                          {metric.trend === "up" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )}
                          <span className="text-xs ml-1">
                            {Math.abs(metric.change)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Users className="h-5 w-5 mr-2 text-green-500" />
                  Client Activity
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Session distribution by time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center bg-gray-800 rounded-lg border border-gray-700">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-gray-400">Activity timeline chart</p>
                    <p className="text-sm text-gray-500">Peak hours: 3-5 PM</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {performanceMetrics.map((metric, index) => (
              <Card key={index} className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base">
                    {metric.metric}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-white">
                      {metric.value}%
                    </span>
                    <div
                      className={`flex items-center ${
                        metric.trend === "up"
                          ? "text-green-500"
                          : "text-red-400"
                      }`}
                    >
                      {metric.trend === "up" ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      <span className="text-sm ml-1">
                        {Math.abs(metric.change)}%
                      </span>
                    </div>
                  </div>
                  <Progress value={metric.value} className="h-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-green-500" />
                  Session Effectiveness by Category
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Performance across different therapy areas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sessionEffectiveness.map((category, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg bg-gray-800 border border-gray-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">
                          {category.category}
                        </span>
                        <Badge className="bg-green-500 text-black">
                          {category.improvement}% improvement
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Sessions: </span>
                          <span className="text-white">
                            {category.sessions}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Avg Duration: </span>
                          <span className="text-white">
                            {category.avgDuration}min
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={category.improvement}
                        className="h-2 mt-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-green-500" />
                  Hourly Engagement Patterns
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Session volume and satisfaction by time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {clientEngagement.map((slot, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-800"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-white font-medium w-20">
                          {slot.timeSlot}
                        </span>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-green-500" />
                          <span className="text-gray-300">
                            {slot.sessions} sessions
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-yellow-500">
                          ★ {slot.satisfaction}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Brain className="h-5 w-5 mr-2 text-green-500" />
                Predictive Insights
              </CardTitle>
              <CardDescription className="text-gray-400">
                AI-powered recommendations for your practice
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {predictiveInsights.map((insight, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg bg-gray-800 border border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-white font-medium mb-1">
                          {insight.insight}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {insight.action}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            insight.confidence > 80 ? "default" : "secondary"
                          }
                          className={
                            insight.confidence > 80
                              ? "bg-green-500 text-black"
                              : ""
                          }
                        >
                          {insight.confidence}% confidence
                        </Badge>
                        {insight.type === "scheduling" && (
                          <Target className="h-4 w-4 text-blue-400" />
                        )}
                        {insight.type === "retention" && (
                          <Users className="h-4 w-4 text-purple-400" />
                        )}
                        {insight.type === "effectiveness" && (
                          <TrendingUp className="h-4 w-4 text-green-400" />
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500 text-green-500 bg-transparent"
                      >
                        Apply Recommendation
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
