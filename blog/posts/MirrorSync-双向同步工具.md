---
title: "MirrorSync 双向同步工具"
date: "2026-08-27"
excerpt: ""
tags: ["工具"]
---

<div align="center">


# 🔄 MirrorSync 双向同步工具

**基于 .NET 6 (WPF) 的 Windows 双向文件同步软件**

在 A、B 两个文件夹（或盘符）之间**实时双向同步**，支持手动同步、冲突/删除策略、自定义过滤规则、系统托盘常驻。

![C#](https://img.shields.io/badge/C%23-10.0-239120?style=flat-square&logo=csharp)
![.NET](https://img.shields.io/badge/.NET-6.0-512BD4?style=flat-square&logo=dotnet)
![WPF](https://img.shields.io/badge/UI-WPF-512BD4?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?style=flat-square&logo=windows)
![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)

</div>

---

## ✨ 功能特性

| 特性             | 说明                                                        |
| ---------------- | ----------------------------------------------------------- |
| 🔁 **双向同步**   | 两侧互为镜像，任意一侧变更自动同步到另一侧                  |
| ⚡ **实时监控**   | `FileSystemWatcher` 双目录监听，400ms 去抖 + 回声抑制防循环 |
| 🖐️ **手动同步**   | 工具栏「立即同步」执行全量扫描对比，带进度条                |
| 🗑️ **删除策略**   | 弹窗确认（默认）/ 自动同步删除 / 永不删除（纯备份）         |
| ⚔️ **冲突策略**   | 弹窗询问（默认）/ 最新时间优先 / 保留双方副本 / 跳过        |
| 🎯 **过滤规则**   | 排除扩展名、文件夹名、隐藏/系统/临时文件                    |
| 🧠 **智能检测**   | 通过 manifest 清单区分「新文件」与「删除」，避免误删        |
| ✅ **校验方式**   | 快速（大小+时间）/ 完整（SHA-256 哈希）                     |
| 🪟 **托盘常驻**   | 关闭最小化到托盘，开机自启可选                              |
| 📄 **完整日志**   | 界面实时显示 + 文件日志（保留 7 天）                        |
| 💻 **命令行模式** | `--sync-once` 支持自动化/批量脚本                           |

---

## 🚀 快速开始

### 方式一：图形界面（日常使用）

1. 从 [Releases](../../releases) 下载安装包并安装（自包含，无需安装 .NET）
2. 打开后点击工具栏「**⚙ 设置**」
3. 填写 **A 盘** 和 **B 盘** 路径（盘符根目录或任意文件夹）
4. 调整策略与过滤规则，点「保存」
5. 程序开始实时监控，也可点「**⟳ 立即同步**」手动全量同步
6. 关闭窗口默认最小化到**系统托盘**，双击托盘图标恢复

### 方式二：命令行（自动化/批量）

```bash
MirrorSync.exe --sync-once --path-a "D:\A" --path-b "D:\B" \
  --delete auto --conflict newest --result result.json
```

| 参数                                        | 说明                                       |
| ------------------------------------------- | ------------------------------------------ |
| `--sync-once`                               | 执行一次全量双向同步后退出（无界面）       |
| `--path-a` / `--path-b`                     | 覆盖配置中的同步路径                       |
| `--delete auto\|prompt\|never`              | 删除策略：自动 / 弹窗(无界面按保留) / 永不 |
| `--conflict newest\|prompt\|keepboth\|skip` | 冲突策略                                   |
| `--result file.json`                        | 结果写入 JSON                              |

退出码：`0` 成功，`1` 异常，`2` 有同步错误。

---

## 🛠️ 从源码构建

环境要求：**.NET SDK 6.0+**（Windows）

```bash
git clone https://github.com/你的用户名/MirrorSync.git
cd MirrorSync

# 构建（Release）
dotnet build MirrorSync.csproj -c Release

# 发布自包含单文件（可选）
dotnet publish MirrorSync.csproj -c Release -r win-x64 --self-contained \
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o publish
```

运行产物：`bin\Release\net6.0-windows\MirrorSync.exe`

---

## 📁 项目结构

```
MirrorSync/
├── App.xaml(.cs)              # 启动入口 + 命令行 headless 模式
├── MainWindow.xaml(.cs)       # 主界面：路径卡片、状态徽章、日志、进度
├── SettingsWindow.xaml(.cs)   # 设置：路径、策略、过滤、开机自启
├── InfoWindow.xaml(.cs)       # 使用说明 / 关于窗口
├── Models/
│   ├── AppConfig.cs           # 配置模型 + 枚举
│   └── SyncModels.cs          # FileMeta / 决策接口 / 清单条目
└── Services/
    ├── SyncEngine.cs          # 核心同步引擎（全量 + 实时 + 决策）
    ├── FileWatcherService.cs  # 双目录实时监控
    ├── ConfigService.cs       # 配置读写
    ├── LogService.cs          # 界面 + 文件日志
    ├── Filter.cs              # 过滤规则
    ├── AutoStartService.cs    # 开机自启（注册表）
    ├── TrayIconService.cs     # 系统托盘
    └── PromptDialogs.cs       # 冲突/删除弹窗 + UI 决策回调
```

---

## 📍 数据存放位置

| 内容     | 路径                                           |
| -------- | ---------------------------------------------- |
| 配置文件 | `%AppData%\MirrorSync\config.json`             |
| 同步清单 | `%AppData%\MirrorSync\manifest.json`           |
| 日志     | `%AppData%\MirrorSync\logs\*.log`（保留 7 天） |

---

## 🔒 安全设计

- 拒绝 A、B 为同一路径或互为子目录（防循环同步）
- 删除/冲突默认**弹窗确认**，误删风险低
- 同步前校验路径存在性
- 未捕获异常写入 `crash.log` 并弹窗，不静默崩溃

---

## 📄 许可证

本项目基于 [GPL-3.0](./LICENSE) 许可证开源。

© 2025 ZYF — 由 DSH + DSv4f 开发
