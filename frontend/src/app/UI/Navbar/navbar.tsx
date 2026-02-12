"use client";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  NavigationMenuIndicator,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { useAuth } from "@/app/context/authContext";

export default function Navbar() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  return (
    <div className="w-full fixed top-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        {/* Logo or brand */}
        <Link href="/" className="text-xl font-bold text-white hover:text-green-400 transition-colors">
          VAD mental health support and analytics
        </Link>

        {/* Navigation Menu */}
        <NavigationMenu>
          <NavigationMenuList className="gap-2">
            <NavigationMenuItem>
              <NavigationMenuTrigger className="text-white hover:text-green-400 transition-colors bg-transparent">
                Home
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <NavigationMenuLink asChild>
                  <Link
                    href="/"
                    className="block px-4 py-2 hover:bg-green-950 rounded-md text-gray-200"
                  >
                    Home
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger className="text-white hover:text-green-400 transition-colors bg-transparent">
                About
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <NavigationMenuLink asChild>
                  <Link
                    href="/about"
                    className="block px-4 py-2 hover:bg-green-950 rounded-md text-gray-200"
                  >
                    About
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger className="text-white hover:text-green-400 transition-colors bg-transparent">
                Resources
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <NavigationMenuLink asChild>
                  <Link
                    href="/resources"
                    className="block px-4 py-2 hover:bg-green-950 rounded-md text-gray-200"
                  >
                    Articles & Tips
                  </Link>
                </NavigationMenuLink>
                <NavigationMenuLink asChild>
                  <Link
                    href="/faq"
                    className="block px-4 py-2 hover:bg-green-950 rounded-md text-gray-200"
                  >
                    FAQs
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>

            {/* Show Dashboard only when authenticated */}
            {isAuthenticated && (
              <NavigationMenuItem>
                <NavigationMenuLink asChild>
                  <Link
                    href="/dashboard"
                    className="text-white hover:text-green-400 transition-colors px-3 py-2"
                  >
                    Dashboard
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
          <NavigationMenuIndicator />
          <NavigationMenuViewport />
        </NavigationMenu>

        {/* Auth Section - Right side */}
        <div className="flex items-center gap-3 ml-4">
          {isLoading ? (
            // Loading state
            <span className="text-sm text-gray-300">Loading...</span>
          ) : isAuthenticated ? (
            // Authenticated state
            <>
              <span className="text-sm text-white">
                Welcome,{" "}
                <span className="font-semibold text-green-400">
                  {user?.name || user?.email}
                </span>
              </span>
              <Button
                asChild
                className="bg-green-600 hover:bg-green-700 text-white rounded-full px-5"
              >
                <Link href="/chat">Start Chat</Link>
              </Button>
              <Button
                onClick={logout}
                variant="outline"
                className="rounded-full px-5 border-white/30 text-white hover:bg-white/10"
              >
                Logout
              </Button>
            </>
          ) : (
            // Not authenticated state
            <>
              <Button
                asChild
                variant="outline"
                className="rounded-full px-5 border-white/30 text-white hover:bg-white/10"
              >
                <Link href="/login">Login</Link>
              </Button>
              <Button
                asChild
                className="bg-green-600 hover:bg-green-700 text-white rounded-full px-5"
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
