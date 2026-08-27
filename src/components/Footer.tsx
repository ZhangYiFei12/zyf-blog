import Link from "next/link";
import { Github, Rss } from "lucide-react";
import { profile } from "@/data/profile";

export default function Footer() {
  return (
    <footer className="border-t border-line mt-24">
      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted font-mono">
          © {new Date().getFullYear()} {profile.name} · Built with Next.js
        </p>
        <div className="flex items-center gap-5 text-muted">
          <span className="font-mono text-xs text-line2 hidden sm:block">
            {profile.enName}
          </span>
          {profile.socials
            .filter((s) => s.icon === "github" || s.icon === "rss")
            .map((s) => (
              <Link
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors"
                aria-label={s.name}
              >
                {s.icon === "github" ? <Github size={18} /> : <Rss size={18} />}
              </Link>
            ))}
        </div>
      </div>
    </footer>
  );
}