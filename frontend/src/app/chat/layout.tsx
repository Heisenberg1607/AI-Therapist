import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "AI Therapist · Session",
  description: "Your personal AI therapy companion",
};

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
