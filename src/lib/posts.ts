import fs from "fs";
import path from "path";
import matter from "gray-matter";

const postsDir = path.join(process.cwd(), "src", "content", "posts");

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  tags: string[];
  cover?: string;
}

export interface Post extends PostMeta {
  content: string;
}

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(postsDir)) return [];
  const files = fs.readdirSync(postsDir);
  const posts = files
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(postsDir, f), "utf-8");
      const { data } = matter(raw);
      return {
        slug: f.replace(/\.(md|mdx)$/, ""),
        title: data.title ?? "无标题",
        date: data.date ? new Date(data.date).toISOString() : "2025-01-01",
        excerpt: data.excerpt ?? "",
        tags: data.tags ?? [],
        cover: data.cover ?? undefined,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return posts;
}

export function getPostBySlug(slug: string): Post | null {
  const ext = [".md", ".mdx"].find((e) =>
    fs.existsSync(path.join(postsDir, `${slug}${e}`))
  );
  if (!ext) return null;
  const raw = fs.readFileSync(path.join(postsDir, `${slug}${ext}`), "utf-8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title ?? "无标题",
    date: data.date ? new Date(data.date).toISOString() : "2025-01-01",
    excerpt: data.excerpt ?? "",
    tags: data.tags ?? [],
    cover: data.cover ?? undefined,
    content,
  };
}