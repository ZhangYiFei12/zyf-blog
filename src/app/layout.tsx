import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { profile } from "@/data/profile";
import "./globals.css";

const siteTitle = profile.role
  ? `${profile.name} · ${profile.role}`
  : profile.name;
const siteDesc = profile.bio[0] ?? profile.tagline;

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: `%s · ${profile.name}`,
  },
  description: siteDesc,
  keywords: [...profile.skills, "个人博客", profile.name].join(", "),
  openGraph: {
    title: siteTitle,
    description: siteDesc,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}