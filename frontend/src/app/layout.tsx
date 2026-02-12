import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./UI/Navbar/navbar";
import Footer from "@/app/UI/Footer/footer";
import { AuthProvider } from "./context/authContext";
import { CallContextProvider } from "./context/callContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Therapist",
  description: "Your personal AI therapy companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <CallContextProvider>
            <Navbar />
            {children}
            <Footer />
          </CallContextProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
