import Link from "next/link";
import type { PostMeta } from "@/lib/posts";

export default function PostCard({ post }: { post: PostMeta }) {
  const dateStr = new Date(post.date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block p-5 rounded-xl border border-line bg-surface hover-card"
    >
      <div className="flex items-center gap-3 mb-2 text-xs text-muted font-mono">
        <span>{dateStr}</span>
        {post.tags.length > 0 && (
          <>
            <span className="text-line2">/</span>
            {post.tags.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded bg-accent/8 text-accent-dim border border-accent/10"
              >
                {t}
              </span>
            ))}
          </>
        )}
      </div>
      <h2 className="text-lg font-semibold text-fg mb-2 group-hover:text-accent transition-colors">
        {post.title}
      </h2>
      {post.excerpt && (
        <p className="text-sm text-muted leading-relaxed line-clamp-2">
          {post.excerpt}
        </p>
      )}
      <div className="mt-3 text-xs font-mono text-accent hover:underline underline-offset-2">
        阅读全文 →
      </div>
    </Link>
  );
}