"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Brain, Shield, Clock, Heart, MessageSquare, TrendingUp, Play } from "lucide-react";
import { useState, useMemo } from "react";

export default function Home() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Generate dot positions once and memoize them
  const dots = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      animationDelay: Math.random() * 3,
      animationDuration: 2 + Math.random() * 3,
    }));
  }, []);

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Green dots background */}
      <div className="absolute inset-0">
        {dots.map((dot) => (
          <div
            key={dot.id}
            className="star absolute w-1 h-1 bg-green-400 rounded-full opacity-100 animate-pulse"
            style={{
              left: `${dot.left}%`,
              top: `${dot.top}%`,
              animationDelay: `${dot.animationDelay}s`,
              animationDuration: `${dot.animationDuration}s`,
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 px-4 md:px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-green-200 to-green-400 bg-clip-text text-transparent">
            Your Personal Voice based Mental Health Support and analytics
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto">
            24/7 Mental Health Support at Your Fingertips
          </p>
          <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto">
            Experience compassionate, confidential therapy sessions powered by advanced AI. 
            Get the support you need, whenever you need it.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link href="/register">
              <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-6 text-lg rounded-full shadow-lg transform transition-all duration-200 hover:scale-105">
                Start Your Journey
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="border-green-500 text-green-400 hover:bg-green-950 font-semibold px-8 py-6 text-lg rounded-full">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-20">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">24/7</div>
              <div className="text-gray-400">Available</div>
            </div>
            {/* <div className="text-center"> */}
              {/* <div className="text-4xl font-bold text-green-400 mb-2">100%</div> */}
              {/* <div className="text-gray-400">Confidential</div> */}
            {/* </div> */}
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">10k+</div>
              <div className="text-gray-400">Users Helped</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">4.9★</div>
              <div className="text-gray-400">Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="relative z-10 py-20 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-white">
            See How It Works
          </h2>
          <p className="text-xl text-gray-300 text-center mb-12 max-w-2xl mx-auto">
            Watch a quick demonstration of how our AI therapist can help you
          </p>
          
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-green-500/20">
            {!isVideoPlaying ? (
              <div className="relative aspect-video bg-gradient-to-br from-green-900/20 to-black flex items-center justify-center group cursor-pointer"
                onClick={() => setIsVideoPlaying(true)}
              >
                <div className="absolute inset-0 bg-black/50"></div>
                <div className="relative z-10 text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 mb-4 rounded-full bg-green-600 group-hover:bg-green-500 transition-all duration-300 transform group-hover:scale-110">
                    <Play className="w-12 h-12 text-white ml-2" />
                  </div>
                  <p className="text-2xl font-semibold text-white">Watch Demo</p>
                  <p className="text-gray-300 mt-2">3 minutes</p>
                </div>
                {/* Placeholder image/gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-600/10 via-transparent to-green-400/10"></div>
              </div>
            ) : (
              <div className="aspect-video bg-black flex items-center justify-center">
                {/* Replace this with your actual video */}
                <video 
                  className="w-full h-full"
                  controls 
                  autoPlay
                  src="/demo-video.mp4"
                  poster="/video-thumbnail.jpg"
                >
                  <source src="/demo-video.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
          
          <p className="text-center text-gray-400 mt-6">
            See how easy it is to connect with your AI therapist and start your healing journey
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4 text-white">
            Why Choose AI Therapist?
          </h2>
          <p className="text-xl text-gray-300 text-center mb-16 max-w-2xl mx-auto">
            Experience the future of mental health support
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="bg-green-950/20 border-green-500/30 p-8 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mb-6">
                <Clock className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">24/7 Availability</h3>
              <p className="text-gray-300">
                Access support whenever you need it. No appointments, no waiting rooms, just immediate help.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-green-950/20 border-green-500/30 p-8 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">100% Confidential</h3>
              <p className="text-gray-300">
                Your privacy is our priority. All conversations are encrypted and completely private.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-green-950/20 border-green-500/30 p-8 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mb-6">
                <Brain className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">AI-Powered Insights</h3>
              <p className="text-gray-300">
                Advanced AI trained on therapeutic techniques to provide personalized support and guidance.
              </p>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-green-950/20 border-green-500/30 p-8 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Voice & Text Support</h3>
              <p className="text-gray-300">
                Talk naturally with voice recognition or type your thoughts - whatever feels comfortable.
              </p>
            </Card>

            {/* Feature 5 */}
            <Card className="bg-green-950/20 border-green-500/30 p-8 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mb-6">
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Track Progress</h3>
              <p className="text-gray-300">
                Monitor your mental health journey with detailed analytics and progress reports.
              </p>
            </Card>

            {/* Feature 6 */}
            <Card className="bg-green-950/20 border-green-500/30 p-8 hover:border-green-500/50 transition-all duration-300 hover:transform hover:scale-105">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mb-6">
                <Heart className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">Compassionate Care</h3>
              <p className="text-gray-300">
                Receive empathetic, judgment-free support designed to help you feel heard and understood.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 py-20 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-white">
            Getting Started is Easy
          </h2>

          <div className="space-y-12">
            {/* Step 1 */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-20 h-20 bg-green-600 rounded-full flex items-center justify-center text-3xl font-bold">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2 text-white">Create Your Account</h3>
                <p className="text-gray-300 text-lg">
                  Sign up in seconds with just your email. No credit card required to start.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-20 h-20 bg-green-600 rounded-full flex items-center justify-center text-3xl font-bold">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2 text-white">Start Your Session</h3>
                <p className="text-gray-300 text-lg">
                  Click &quot;Start Session&quot; and begin talking with your AI therapist immediately.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-20 h-20 bg-green-600 rounded-full flex items-center justify-center text-3xl font-bold">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2 text-white">Begin Your Healing Journey</h3>
                <p className="text-gray-300 text-lg">
                  Share your thoughts, feelings, and concerns in a safe, confidential environment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-4 md:px-6 mb-20">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="bg-gradient-to-br from-green-900/40 to-green-950/40 border-green-500/30 p-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Ready to Start Your Journey?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of people who have found support and healing through AI therapy.
            </p>
            <Link href="/register">
              <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-12 py-6 text-xl rounded-full shadow-lg transform transition-all duration-200 hover:scale-105">
                Get Started Free
              </Button>
            </Link>
            <p className="text-gray-400 mt-6">
              No credit card required • Start in 30 seconds
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
