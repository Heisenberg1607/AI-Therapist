"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/authContext";

export default function Navbar() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/resources", label: "Resources" },
    { href: "/faq", label: "FAQ" },
  ];

  if (isAuthenticated) {
    navItems.push({ href: "/dashboard", label: "Dashboard" });
  }

  return (
    <div className="w-full fixed top-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 gap-4">
        <Link
          href="/"
          className="text-xl font-bold text-white hover:text-green-400 transition-colors shrink-0"
        >
          AI Therapist
        </Link>

        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "text-green-400 bg-white/10"
                    : "text-white hover:text-green-400 hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

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
