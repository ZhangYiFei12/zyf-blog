---
title: "Git 常用命令速查"
category: "开发工具"
date: "2026-09-10"
excerpt: "日常工作最常用的 Git 命令，含分支、回滚、rebase 场景。"
tags: ["Git", "速查"]
---

# Git 常用命令速查

## 基础操作

```bash
git status              # 查看工作区状态
git add -A              # 暂存所有改动
git commit -m "msg"     # 提交
git push origin main    # 推送
```

## 分支管理

| 命令 | 说明 |
| --- | --- |
| `git branch` | 列出本地分支 |
| `git switch -c feat` | 新建并切换分支 |
| `git merge feat` | 合并分支 |

## 回滚

- `git restore <file>` —— 丢弃工作区改动
- `git reset --soft HEAD~1` —— 撤销提交但保留改动
- `git revert <sha>` —— 生成一个反向提交（安全，推荐用于已推送）
