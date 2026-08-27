import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";

export const metadata: Metadata = {
  title: "博客",
};

export default function BlogPage() {
  const posts = getAllPosts();

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
          <span className="text-accent">//</span> 博客
        </h1>
        <p className="text-muted text-sm mb-10">
          技术沉淀、项目实践与一些随想，共 {posts.length} 篇
        </p>

        {posts.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <p className="font-mono text-lg mb-2">空空如也</p>
            <p className="text-sm">
              还没有文章，在 <code className="text-accent font-mono">src/content/posts/</code>{" "}
              目录下添加一个 .md 文件即可发布
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}