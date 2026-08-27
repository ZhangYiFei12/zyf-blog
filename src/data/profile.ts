// ============================================================
// 个人信息配置 —— 修改这里即可更新全站资料
// ============================================================

export interface SocialLink {
  name: string;
  url: string;
  icon: "github" | "wechat" | "bilibili" | "mail" | "rss";
  username?: string;
}

export interface Profile {
  name: string;
  enName: string;
  role: string;
  tagline: string;
  bio: string[];
  avatar: string; // 头像路径，放在 public/ 下
  location: string;
  email: string;
  socials: SocialLink[];
  skills: string[];
}

export const profile: Profile = {
  name: "张义飞",
  enName: "Yifei Zhang",
  role: "",
  tagline: "Build. Break. Learn. Repeat.",
  bio: [],
  avatar: "/images/avatar.png", // 头像照片，替换图片时覆盖 public/images/avatar.png 即可
  location: "中国",
  email: "264296445@qq.com",
  socials: [
    { name: "GitHub", url: "https://github.com/ZhangYiFei12", username: "ZhangYiFei12", icon: "github" },
    { name: "Bilibili", url: "https://www.bilibili.com/", username: "张义飞", icon: "bilibili" },
    { name: "邮箱", url: "mailto:264296445@qq.com", username: "264296445@qq.com", icon: "mail" },
    { name: "RSS", url: "/feed.xml", icon: "rss" },
  ],
  skills: [
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "Python",
    "FastAPI",
    "Tailwind CSS",
    "PostgreSQL",
    "Docker",
    "Git",
    "Rust",
    "机器学习",
  ],
};
