import Link from "next/link";
import { ArrowUpRight, Github } from "lucide-react";
import type { Project } from "@/data/projects";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="p-5 rounded-xl border border-line bg-surface hover-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-fg">{project.title}</h3>
        <div className="flex gap-2 shrink-0">
          {project.url && (
            <Link
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-surface2 transition-colors"
              aria-label="访问项目"
            >
              <ArrowUpRight size={16} />
            </Link>
          )}
          {project.repo && (
            <Link
              href={project.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-surface2 transition-colors"
              aria-label="源代码"
            >
              <Github size={16} />
            </Link>
          )}
        </div>
      </div>
      <p className="text-sm text-muted leading-relaxed mb-4">
        {project.description}
      </p>
      <div className="flex flex-wrap gap-2">
        {project.tech.map((t) => (
          <span
            key={t}
            className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-accent/8 text-accent-dim border border-accent/15"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}