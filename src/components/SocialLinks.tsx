"use client";

import { Mail, Github, Rss, MessageCircle } from "lucide-react";
import type { SocialLink } from "@/data/profile";

const iconMap: Record<string, React.ReactNode> = {
  github: <Github size={18} />,
  mail: <Mail size={18} />,
  rss: <Rss size={18} />,
  wechat: <MessageCircle size={18} />,
  bilibili: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.267.573-.4.92-.4.346 0 .653.133.92.4L9.653 4.44c.089.071.16.16.214.267.053.107.089.214.107.32h3.987c.036-.125.072-.241.107-.347.142-.231.329-.418.56-.56l3.587-3.587c.267-.267.573-.4.92-.4.346 0 .653.133.92.4l.027.027c.267.267.4.569.4.906 0 .338-.133.64-.4.907l-1.227 1.2zm-1.574 1.6H7.787l-.373.347h8.825l-.373-.347h-1.6zm-6.4 1.707c-.373 0-.684.129-.933.387-.25.258-.382.571-.4.94v.053c0 .373.129.689.387.947.258.258.573.391.946.4.356 0 .667-.133.934-.4.266-.267.4-.578.4-.934 0-.373-.134-.689-.4-.946a1.28 1.28 0 0 0-.934-.387v-.06zm8.96 0c-.373 0-.684.129-.933.387-.25.258-.382.571-.4.94v.053c0 .373.129.689.387.947.258.258.573.391.946.4.356 0 .667-.133.934-.4.266-.267.4-.578.4-.934 0-.373-.134-.689-.4-.946a1.28 1.28 0 0 0-.934-.387v-.06z" />
    </svg>
  ),
};

export default function SocialLinks({ socials }: { socials: SocialLink[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {socials.map((s) => (
        <a
          key={s.name}
          href={s.url}
          target={s.icon !== "mail" ? "_blank" : undefined}
          rel={s.icon !== "mail" ? "noopener noreferrer" : undefined}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-line bg-surface text-sm text-muted
                     hover:text-accent hover:border-accent/40 hover:bg-surface2 transition-all duration-200"
        >
          {iconMap[s.icon] ?? null}
          <span>{s.username ?? s.name}</span>
        </a>
      ))}
    </div>
  );
}