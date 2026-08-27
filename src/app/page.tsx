import Link from "next/link";
import { ArrowRight, Terminal } from "lucide-react";
import { profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { experience } from "@/data/experience";
import { getAllPosts } from "@/lib/posts";
import SocialLinks from "@/components/SocialLinks";
import ExperienceTimeline from "@/components/ExperienceTimeline";
import ProjectCard from "@/components/ProjectCard";
import PostCard from "@/components/PostCard";
import PhotoUploader from "@/components/PhotoUploader";

export default function HomePage() {
  const posts = getAllPosts().slice(0, 3);
  const featuredProjects = projects.filter((p) => p.featured).slice(0, 2);
  const latestExperience = experience.slice(0, 3);

  return (
    <div className="grid-bg">
      <div className="max-w-4xl mx-auto px-6">
        {/* ========== HERO ========== */}
        <section className="pt-24 pb-16 md:pt-28 md:pb-20">
          <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-12">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3 text-sm font-mono text-accent-dim">
                <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span>在线 · 开放工作</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-fg">
                {profile.name}
                <span className="block text-xl md:text-2xl text-muted font-normal mt-1">
                  {profile.enName}
                </span>
              </h1>
              {profile.role && (
                <p className="text-lg text-accent neon-text font-mono">
                  {profile.role}
                </p>
              )}
              <p className="text-muted leading-relaxed max-w-lg">
                {profile.tagline}
              </p>
              <div className="pt-2">
                <SocialLinks socials={profile.socials} />
              </div>
            </div>

            <div className="shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl border-2 border-line overflow-hidden bg-surface flex items-center justify-center">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Terminal size={48} className="text-line2" />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========== BIO ========== */}
        {profile.bio.length > 0 && (
          <section className="py-10 border-t border-line">
            <div className="max-w-2xl space-y-3">
              {profile.bio.map((p, i) => (
                <p key={i} className="text-muted leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* ========== 精选项目 ========== */}
        <section className="py-14">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-fg font-mono">
              <span className="text-accent mr-2">//</span>
              精选项目
            </h2>
            <Link
              href="/projects"
              className="text-sm text-muted hover:text-accent font-mono flex items-center gap-1 transition-colors"
            >
              查看全部 <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {featuredProjects.map((p) => (
              <ProjectCard key={p.title} project={p} />
            ))}
          </div>
        </section>

        {/* ========== 最新博客 ========== */}
        {posts.length > 0 && (
          <section className="py-14 border-t border-line">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-semibold text-fg font-mono">
                <span className="text-accent mr-2">//</span>
                最新文章
              </h2>
              <Link
                href="/blog"
                className="text-sm text-muted hover:text-accent font-mono flex items-center gap-1 transition-colors"
              >
                查看全部 <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        )}

        {/* ========== 经历 ========== */}
        <section className="py-14 border-t border-line">
          <h2 className="text-lg font-semibold text-fg font-mono mb-8">
            <span className="text-accent mr-2">//</span>
            经历
          </h2>
          <ExperienceTimeline items={latestExperience} />
        </section>

        {/* ========== 照片上传 ========== */}
        <section className="py-14 border-t border-line">
          <h2 className="text-lg font-semibold text-fg font-mono mb-8">
            <span className="text-accent mr-2">//</span>
            照片上传
          </h2>
          <div className="max-w-md">
            <PhotoUploader />
          </div>
        </section>
      </div>
    </div>
  );
}