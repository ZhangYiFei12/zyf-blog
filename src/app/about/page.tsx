import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Terminal, Mail } from "lucide-react";
import { profile } from "@/data/profile";
import { experience } from "@/data/experience";
import ExperienceTimeline from "@/components/ExperienceTimeline";
import SocialLinks from "@/components/SocialLinks";

export const metadata: Metadata = {
  title: "关于我",
};

export default function AboutPage() {
  return (
    <div className="grid-bg">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent font-mono transition-colors mb-8"
        >
          <ArrowLeft size={14} /> 返回首页
        </Link>

        <h1 className="text-2xl font-bold text-fg mb-2 font-mono">
          <span className="text-accent">//</span> 关于我
        </h1>

        {/* 简介 */}
        <section className="py-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="w-24 h-24 rounded-xl border-2 border-line overflow-hidden bg-surface shrink-0 flex items-center justify-center">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Terminal size={36} className="text-line2" />
              )}
            </div>
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-fg">{profile.name}</h2>
              {profile.role && (
                <p className="text-sm text-accent font-mono">{profile.role}</p>
              )}
              {profile.bio.map((p, i) => (
                <p key={i} className="text-sm text-muted leading-relaxed">
                  {p}
                </p>
              ))}
              <p className="text-sm text-muted font-mono">
                📍 {profile.location} · {profile.email}
              </p>
              <SocialLinks socials={profile.socials} />
            </div>
          </div>
        </section>

        {/* 完整经历 */}
        <section className="py-8 border-t border-line">
          <h2 className="text-lg font-semibold text-fg font-mono mb-8">
            <span className="text-accent mr-2">//</span>
            个人经历
          </h2>
          <ExperienceTimeline items={experience} />
        </section>

        {/* 联系 */}
        <section className="py-8 border-t border-line">
          <h2 className="text-lg font-semibold text-fg font-mono mb-4">
            <span className="text-accent mr-2">//</span>
            联系我
          </h2>
          <a
            href={`mailto:${profile.email}`}
            className="inline-flex items-center gap-2 text-accent font-mono hover:underline underline-offset-4"
          >
            <Mail size={16} />
            {profile.email}
          </a>
        </section>
      </div>
    </div>
  );
}