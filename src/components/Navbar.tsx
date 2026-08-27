"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal } from "lucide-react";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/blog", label: "博客" },
  { href: "/projects", label: "项目" },
  { href: "/about", label: "关于我" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
      <nav className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Terminal size={20} className="text-accent" />
          <span className="font-mono font-bold tracking-tight text-fg group-hover:text-accent transition-colors">
            zhangyifei<span className="text-accent">.dev</span>
          </span>
        </Link>

        <ul className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`px-3 sm:px-4 py-2 rounded-md text-sm transition-colors font-mono ${
                    active
                      ? "text-accent bg-accent/10"
                      : "text-muted hover:text-fg hover:bg-surface"
                  }`}
                >
                  {active && <span className="text-accent mr-1">›</span>}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}