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

export default function Navbar() {
  return (
    <div className="w-full   shadow-sm fixed top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        {/* Logo or brand */}
        <Link href="/" className="text-xl font-bold text-blue-600">
          AI Therapist
        </Link>

        {/* Navigation Menu */}
        <NavigationMenu>
          <NavigationMenuList className="gap-2">
            <NavigationMenuItem>
              <NavigationMenuTrigger className="text-gray-700 hover:text-blue-600 transition-colors">
                Home
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <NavigationMenuLink asChild>
                  <Link
                    href="/"
                    className="block px-4 py-2 hover:bg-blue-50 rounded-md text-gray-700"
                  >
                    Home
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger className="text-gray-700 hover:text-blue-600 transition-colors">
                About
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <NavigationMenuLink asChild>
                  <Link
                    href="/about"
                    className="block px-4 py-2 hover:bg-blue-50 rounded-md text-gray-700"
                  >
                    About
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger className="text-gray-700 hover:text-blue-600 transition-colors">
                Resources
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <NavigationMenuLink asChild>
                  <Link
                    href="/resources"
                    className="block px-4 py-2 hover:bg-blue-50 rounded-md text-gray-700"
                  >
                    Articles & Tips
                  </Link>
                </NavigationMenuLink>
                <NavigationMenuLink asChild>
                  <Link
                    href="/faq"
                    className="block px-4 py-2 hover:bg-blue-50 rounded-md text-gray-700"
                  >
                    FAQs
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
          <NavigationMenuIndicator />
          <NavigationMenuViewport />
        </NavigationMenu>

        {/* Call to action button */}
        <Button
          asChild
          className="ml-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5"
        >
          <Link href="/chat">Start Chat</Link>
        </Button>
      </div>
    </div>
  );
}
