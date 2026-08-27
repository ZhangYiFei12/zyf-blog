// ============================================================
// 技能标签配置 —— 可分组、可设置熟练度(0-100)
// ============================================================

export interface Skill {
  name: string;
  level: number; // 0-100
  group: string;
}

export const skillGroups = ["前端", "后端", "工具与运维", "AI"] as const;

export const skills: Skill[] = [
  { name: "TypeScript", level: 90, group: "前端" },
  { name: "React", level: 88, group: "前端" },
  { name: "Next.js", level: 85, group: "前端" },
  { name: "Tailwind CSS", level: 87, group: "前端" },
  { name: "HTML / CSS", level: 92, group: "前端" },

  { name: "Node.js", level: 84, group: "后端" },
  { name: "Python", level: 82, group: "后端" },
  { name: "FastAPI", level: 78, group: "后端" },
  { name: "PostgreSQL", level: 75, group: "后端" },
  { name: "Rust", level: 55, group: "后端" },

  { name: "Docker", level: 74, group: "工具与运维" },
  { name: "Git", level: 90, group: "工具与运维" },
  { name: "Linux", level: 80, group: "工具与运维" },
  { name: "CI/CD", level: 72, group: "工具与运维" },

  { name: "机器学习", level: 68, group: "AI" },
  { name: "Prompt Engineering", level: 85, group: "AI" },
];
