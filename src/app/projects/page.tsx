import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { projects } from "@/data/projects";
import ProjectCard from "@/components/ProjectCard";

export const metadata: Metadata = {
  title: "项目作品",
};

export default function ProjectsPage() {
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
          <span className="text-accent">//</span> 项目作品
        </h1>
        <p className="text-muted text-sm mb-10">
          一些折腾过的项目，从想法到落地
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.title} project={p} />
          ))}
        </div>
      </div>
    </div>
  );
}