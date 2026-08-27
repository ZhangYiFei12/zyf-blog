// ============================================================
// 个人经历配置 —— 按时间倒序排列
// ============================================================

export interface ExperienceItem {
  period: string;
  title: string;
  org: string;
  description: string[];
  tags?: string[];
}

export const experience: ExperienceItem[] = [
  {
    period: "2023 — 至今",
    title: "全栈开发者",
    org: "某科技公司",
    description: [
      "负责公司核心产品的前端架构设计与开发，主导从 0 到 1 搭建前端工程体系。",
      "参与后端服务开发与优化，将接口平均响应时间降低 40%。",
    ],
    tags: ["Next.js", "Node.js", "PostgreSQL"],
  },
  {
    period: "2021 — 2023",
    title: "前端开发工程师",
    org: "互联网初创公司",
    description: [
      "独立负责公司官网与 Web 应用的开发与迭代。",
      "搭建组件库与设计系统，提升团队 30% 的开发效率。",
    ],
    tags: ["React", "TypeScript", "Tailwind CSS"],
  },
  {
    period: "2017 — 2021",
    title: "计算机科学与技术 · 本科",
    org: "某大学",
    description: [
      "主修计算机科学与技术，系统学习数据结构、算法与操作系统等核心课程。",
      "参与校内开源社团，积累了第一个真实的协作项目经验。",
    ],
    tags: ["算法", "C++", "Python"],
  },
];
