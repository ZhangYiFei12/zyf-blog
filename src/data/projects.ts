// ============================================================
// 项目作品配置
// ============================================================

export interface Project {
  title: string;
  description: string;
  tech: string[];
  url?: string;
  repo?: string;
  featured?: boolean;
  year: string;
}

export const projects: Project[] = [
  {
    title: "个人博客系统",
    description:
      "就是你正在浏览的这个网站！基于 Next.js 15 + TypeScript + Tailwind CSS 构建，支持 Markdown 写作、照片上传与科技简约风格主题。",
    tech: ["Next.js", "TypeScript", "Tailwind CSS"],
    url: "/",
    repo: "https://github.com/",
    featured: true,
    year: "2025",
  },
  {
    title: "AI 学习助手",
    description:
      "一个基于大语言模型的智能学习助手 Web 应用，支持对话式问答、笔记管理与知识卡片生成。",
    tech: ["React", "FastAPI", "Python", "OpenAI API"],
    repo: "https://github.com/",
    featured: true,
    year: "2024",
  },
  {
    title: "数据可视化仪表盘",
    description:
      "面向运营团队的实时数据监控仪表盘，支持多数据源接入、自定义图表与告警推送。",
    tech: ["Next.js", "ECharts", "WebSocket"],
    url: "https://example.com",
    year: "2024",
  },
  {
    title: "终端风格个人站 v1",
    description:
      "我的第一个个人网站，一个仿真终端界面，支持输入命令浏览我的技能与项目，蛮有 geek 范儿。",
    tech: ["HTML", "CSS", "JavaScript"],
    url: "https://example.com",
    year: "2023",
  },
];
