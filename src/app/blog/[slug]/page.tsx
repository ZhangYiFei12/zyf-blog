import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPostBySlug, getAllPosts } from "@/lib/posts";
import { MarkdownContent } from "@/components/MarkdownContent";

export const dynamicParams = false;

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "未找到" };
  return { title: post.title };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const dateStr = new Date(post.date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="grid-bg">
      <article className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent font-mono transition-colors mb-8"
        >
          <ArrowLeft size={14} /> 返回博客
        </Link>

        <header className="mb-10">
          <h1 className="text-2xl md:text-3xl font-bold text-fg mb-4">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted font-mono">
            <span>{dateStr}</span>
            <span className="text-line2">/</span>
            {post.tags.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded bg-accent/8 text-accent-dim border border-accent/10 text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </header>

        <div className="prose-md">
          <MarkdownContent content={post.content} />
        </div>
      </article>
    </div>
  );
}