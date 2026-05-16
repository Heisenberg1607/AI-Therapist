"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/app/context/authContext";

export default function Navbar() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  return (
    <div className="w-full fixed top-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 gap-4">
        <Link
          href="/"
          className="text-xl font-bold text-white hover:text-green-400 transition-colors shrink-0"
        >
          AI Therapist
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {isLoading ? (
            <span className="text-sm text-gray-300">Loading...</span>
          ) : isAuthenticated ? (
            <>
              <span className="hidden lg:inline text-sm text-white">
                Welcome,{" "}
                <span className="font-semibold text-green-400">
                  {user?.name || user?.email}
                </span>
              </span>
              <Button
                asChild
                className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 sm:px-5"
              >
                <Link href="/chat">Start Chat</Link>
              </Button>
              <Button
                onClick={logout}
                variant="outline"
                className="rounded-full px-4 sm:px-5 border-white/30 text-white hover:bg-white/10"
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button
                asChild
                variant="outline"
                className="rounded-full px-4 sm:px-5 border-white/30 text-white hover:bg-white/10"
              >
                <Link href="/login">Login</Link>
              </Button>
              <Button
                asChild
                className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4 sm:px-5"
              >
                <Link href="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
