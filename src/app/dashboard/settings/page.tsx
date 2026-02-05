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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  User,
  Bell,
  Shield,
  Brain,
  CreditCard,
  Clock,
  Mail,
  Save,
  Upload,
  Key,
  Smartphone,
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsReminders: false,
    sessionReminders: true,
    emergencyAlerts: true,
    weeklyReports: true,
  });

  const [aiSettings, setAiSettings] = useState({
    responseStyle: "empathetic",
    sessionLength: "45",
    autoFollowUp: true,
    crisisDetection: true,
    languageModel: "advanced",
  });

  const specialties = [
    "Anxiety Disorders",
    "Depression",
    "PTSD",
    "Addiction Recovery",
    "Family Therapy",
    "Couples Counseling",
    "Child Psychology",
    "Eating Disorders",
    "Grief Counseling",
    "Stress Management",
  ];

  const [selectedSpecialties, setSelectedSpecialties] = useState([
    "Anxiety Disorders",
    "Depression",
    "Stress Management",
  ]);

  return (
    <div className="p-8 mt-10">
      

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger
            value="profile"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="practice"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            <Settings className="h-4 w-4 mr-2" />
            Practice
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            <Brain className="h-4 w-4 mr-2" />
            AI Settings
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger
            value="billing"
            className="data-[state=active]:bg-green-500 data-[state=active]:text-black"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  Personal Information
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Update your personal details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-green-500 text-black font-semibold text-xl">
                      AK
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Change Photo
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-gray-300">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      defaultValue="Atharva"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-gray-300">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      defaultValue="Kurumbhatte"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email" className="text-gray-300">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="athru@csu.fullerton.edu"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-gray-300">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    defaultValue="+1 (657) 7519070"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  Professional Details
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Your credentials and practice information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="license" className="text-gray-300">
                    License Number
                  </Label>
                  <Input
                    id="license"
                    defaultValue="LPC-12345"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="credentials" className="text-gray-300">
                    Credentials
                  </Label>
                  <Input
                    id="credentials"
                    defaultValue="LMFT, PhD"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="experience" className="text-gray-300">
                    Years of Experience
                  </Label>
                  <Select defaultValue="5-10">
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="1-2">1-2 years</SelectItem>
                      <SelectItem value="3-5">3-5 years</SelectItem>
                      <SelectItem value="5-10">5-10 years</SelectItem>
                      <SelectItem value="10+">10+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bio" className="text-gray-300">
                    Professional Bio
                  </Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell clients about your approach and experience..."
                    className="bg-gray-800 border-gray-700 text-white"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="flex justify-end">
            <Button className="bg-green-500 hover:bg-green-600 text-black">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="practice" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Practice Hours</CardTitle>
                <CardDescription className="text-gray-400">
                  Set your availability schedule
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => (
                  <div key={day} className="flex items-center justify-between">
                    <span className="text-gray-300 w-20">{day}</span>
                    <div className="flex items-center space-x-2">
                      <Switch defaultChecked={day !== "Sunday"} />
                      <Input
                        defaultValue="9:00 AM"
                        className="w-24 bg-gray-800 border-gray-700 text-white text-sm"
                      />
                      <span className="text-gray-400">to</span>
                      <Input
                        defaultValue="5:00 PM"
                        className="w-24 bg-gray-800 border-gray-700 text-white text-sm"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Specialties</CardTitle>
                <CardDescription className="text-gray-400">
                  Select your areas of expertise
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {specialties.map((specialty) => (
                    <div
                      key={specialty}
                      className="flex items-center justify-between"
                    >
                      <span className="text-gray-300 text-sm">{specialty}</span>
                      <Switch
                        checked={selectedSpecialties.includes(specialty)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSpecialties([
                              ...selectedSpecialties,
                              specialty,
                            ]);
                          } else {
                            setSelectedSpecialties(
                              selectedSpecialties.filter((s) => s !== specialty)
                            );
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">
                    Selected specialties:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSpecialties.map((specialty) => (
                      <Badge
                        key={specialty}
                        className="bg-green-500 text-black"
                      >
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-gray-400">
                Choose how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-white font-medium">Email Alerts</p>
                    <p className="text-gray-400 text-sm">
                      Receive important updates via email
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notifications.emailAlerts}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailAlerts: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Smartphone className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-white font-medium">SMS Reminders</p>
                    <p className="text-gray-400 text-sm">
                      Get text message reminders
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notifications.smsReminders}
                  onCheckedChange={(checked) =>
                    setNotifications({
                      ...notifications,
                      smsReminders: checked,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-white font-medium">Session Reminders</p>
                    <p className="text-gray-400 text-sm">
                      Notifications before scheduled sessions
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notifications.sessionReminders}
                  onCheckedChange={(checked) =>
                    setNotifications({
                      ...notifications,
                      sessionReminders: checked,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bell className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-white font-medium">Emergency Alerts</p>
                    <p className="text-gray-400 text-sm">
                      Critical notifications for crisis situations
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notifications.emergencyAlerts}
                  onCheckedChange={(checked) =>
                    setNotifications({
                      ...notifications,
                      emergencyAlerts: checked,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Settings className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-white font-medium">Weekly Reports</p>
                    <p className="text-gray-400 text-sm">
                      Summary of your practice performance
                    </p>
                  </div>
                </div>
                <Switch
                  checked={notifications.weeklyReports}
                  onCheckedChange={(checked) =>
                    setNotifications({
                      ...notifications,
                      weeklyReports: checked,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  AI Model Configuration
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Customize AI behavior and responses
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="responseStyle" className="text-gray-300">
                    Response Style
                  </Label>
                  <Select
                    value={aiSettings.responseStyle}
                    onValueChange={(value) =>
                      setAiSettings({ ...aiSettings, responseStyle: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="empathetic">Empathetic</SelectItem>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="supportive">Supportive</SelectItem>
                      <SelectItem value="analytical">Analytical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sessionLength" className="text-gray-300">
                    Default Session Length (minutes)
                  </Label>
                  <Select
                    value={aiSettings.sessionLength}
                    onValueChange={(value) =>
                      setAiSettings({ ...aiSettings, sessionLength: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                      <SelectItem value="90">90 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="languageModel" className="text-gray-300">
                    Language Model
                  </Label>
                  <Select
                    value={aiSettings.languageModel}
                    onValueChange={(value) =>
                      setAiSettings({ ...aiSettings, languageModel: value })
                    }
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="specialized">Specialized</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">AI Features</CardTitle>
                <CardDescription className="text-gray-400">
                  Enable or disable AI capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Auto Follow-up</p>
                    <p className="text-gray-400 text-sm">
                      Automatically schedule follow-up sessions
                    </p>
                  </div>
                  <Switch
                    checked={aiSettings.autoFollowUp}
                    onCheckedChange={(checked) =>
                      setAiSettings({ ...aiSettings, autoFollowUp: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Crisis Detection</p>
                    <p className="text-gray-400 text-sm">
                      AI monitors for crisis indicators
                    </p>
                  </div>
                  <Switch
                    checked={aiSettings.crisisDetection}
                    onCheckedChange={(checked) =>
                      setAiSettings({ ...aiSettings, crisisDetection: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  Password & Authentication
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Manage your account security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword" className="text-gray-300">
                    Current Password
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword" className="text-gray-300">
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-gray-300">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <Button className="w-full bg-green-500 hover:bg-green-600 text-black">
                  <Key className="h-4 w-4 mr-2" />
                  Update Password
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Add an extra layer of security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div>
                    <p className="text-white font-medium">SMS Authentication</p>
                    <p className="text-gray-400 text-sm">
                      Receive codes via text message
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div>
                    <p className="text-white font-medium">Authenticator App</p>
                    <p className="text-gray-400 text-sm">
                      Use Google Authenticator or similar
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Current Plan</CardTitle>
                <CardDescription className="text-gray-400">
                  Your subscription details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-gray-800 border border-green-500">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold">
                      Professional Plan
                    </h3>
                    <Badge className="bg-green-500 text-black">Active</Badge>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Unlimited sessions, advanced AI features
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white">$99</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Next billing date</span>
                    <span className="text-white">January 15, 2024</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Sessions this month</span>
                    <span className="text-white">67 / Unlimited</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Payment Method</CardTitle>
                <CardDescription className="text-gray-400">
                  Manage your billing information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="h-6 w-6 text-green-500" />
                      <div>
                        <p className="text-white font-medium">
                          •••• •••• •••• 4242
                        </p>
                        <p className="text-gray-400 text-sm">Expires 12/25</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                    >
                      Update
                    </Button>
                  </div>
                </div>
                <Button className="w-full bg-green-500 hover:bg-green-600 text-black">
                  View Billing History
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
