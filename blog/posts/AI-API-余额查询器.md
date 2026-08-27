---
title: "AI API 余额查询器"
date: "2026-08-27"
excerpt: ""
tags: ["工具"]
---

# ⚡ AI API 余额查询器

一个本地运行的 **Electron 桌面应用**，用于查询主流 AI 大模型平台的 **API 用量与剩余余额/额度**。
支持多账号管理，API Key 使用 Windows 系统级加密（DPAPI / safeStorage）保存在本机，绝不上传。

## ✨ 功能特点

- 🖥️ **桌面应用**：独立窗口，双击即用（支持打包为安装包）
- ➕ **自定义平台**：支持把任意 API 服务接入——
  - **OpenAI 兼容模式**：只需填 Base URL + Key，自动适配 new-api / one-api 等所有中转站
  - **完全自定义 REST 模式**：自由配置 GET 接口 URL、认证方式（Bearer / 自定义 Header / 无）、响应 JSON 字段路径
- 🔐 **网页登录方式**：账号支持「API Key」与「网页登录」两种接入——
  - **DeepSeek**：支持邮箱+密码**自动登录**（真实调用官方登录接口），自动查询余额与用量（token 数 / 消费金额）
  - **其他平台**：支持粘贴 Cookie/Token + 可配置数据接口的通用网页抓取（网页接口非公开的平台需自行配置），OpenAI/Anthropic/阿里云因 2FA/风控建议使用 API Key 方式
- 💰 **一键充值**：每个账号卡片带「💰 充值」按钮，点击自动打开对应平台官网的充值/计费页面（各平台充值地址已内置并验证）
- 🪟 **悬浮小窗**：始终置顶的迷你余额显示窗，可拖拽、一键刷新、直达主窗口
- ⏱️ **实时更新（自动刷新）**：可设置 30 秒 ~ 30 分钟间隔自动查询所有账号，主窗口和悬浮窗同步更新
- 📥 **系统托盘**：支持最小化到托盘、关闭按钮最小化到托盘，托盘右键菜单一键操作
- 🎨 **自定义背景**：6 套预设渐变背景一键切换，也支持选择本地图片作为背景（自动加暗色遮罩保证可读性），设置即时生效并持久保存
- 🌐 **全局代理**：支持自定义 HTTP(S)/SOCKS5 代理，解决 OpenAI / Anthropic 等平台在国内无法直连的问题
- ⚠️ **余额告警**：可设置余额阈值，余额低于阈值时卡片红色高亮提醒
- 💰 **成本估算**：OpenAI 组织级用量按模型单价自动估算本月成本（USD）
- 📈 **用量趋势图**：每次查询自动保存本地快照，账号卡片「📈 趋势」按钮查看余额/用量历史折线图
- ⚡ **全局快捷键**：`Ctrl+Shift+R` 一键刷新全部账号，`Ctrl+Shift+A` 唤起主窗口
- ☀️ **亮色/深色主题**：设置中一键切换界面主题，即时生效并持久保存
- 📥 **账号分组管理**：账号可设置分组，支持按分组筛选、搜索，以及按名称/分组/余额/用量排序
- 🔔 **余额主动告警**：余额低于阈值时触发 Windows 系统通知 + 提示音，悬浮窗同步标红
- 🗝️ **多平台支持**，一次添加、一键全部刷新：

| 平台                      | 余额/额度                         | 用量                                                         | 说明                                            |
| ------------------------- | --------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| **DeepSeek**              | ✅ 账户余额（含充值+赠送分开显示） | ❌ 官方无公开接口                                             | 用量请登录官网查看                              |
| **OpenAI**                | ✅ 月度计费额度                    | ✅ 本月消费金额 + **各 API Key 使用记录** + **各模型 Token 用量** + **成本估算** | 用量/Key 明细查询建议使用 **Admin 权限 Key**    |
| **Anthropic (Claude)**    | ❌ 后付费无余额                    | ✅ Token 用量                                                 | 需 **管理员角色** API Key                       |
| **通义千问 / 阿里云百炼** | ✅ 账户可用余额（现金/信用额度）   | ❌ 官方无公开接口                                             | 需 AccessKey（RAM 用户授予 BSS 只读权限）       |
| **智谱 GLM**              | ❌ 后付费无余额                    | ❌ 官方无公开接口                                             | 提供 Key 连通性检查与计费指引                   |
| **硅基流动**              | ✅ 账户余额                        | ❌ 官方无公开接口                                             | `user/info` 接口                                |
| **Kimi (Moonshot)**       | ✅ 可用余额（现金/赠送分开）       | ✅ 本月消费 + 累计充值                                        | 官方余额/消费接口，`sk-...` Key 即查            |
| **小米 MiMo**             | ✅ 账户余额                        | ✅ Token 用量                                                 | 网页登录方式（小米账号认证，需复制登录 Cookie） |

- 🔐 **安全存储**：API Key 经 Electron `safeStorage`（Windows DPAPI）加密后写入本机配置文件，界面仅显示脱敏值（`sk-ab••••••••cd`），原始 Key 仅在主进程查询时使用
- 📊 **结果清晰**：余额大字展示、用量/成本、附加信息、官方控制台直达链接、原始 JSON 可折叠查看
- ⏱️ 查询带 30 秒超时保护，单个账号失败不影响其他账号

## 🚀 快速开始

### 方式一：源码运行（开发模式）

```bash
# 需要 Node.js 16+ 与 npm
npm install          # 安装依赖（国内可加 --registry=https://registry.npmmirror.com）
npm start            # 启动应用
```

### 方式二：打包安装包

```bash
npm run pack         # 生成免安装目录 dist/win-unpacked/
npm run dist         # 生成 NSIS 安装程序（dist/*.exe）
```

国内网络若下载较慢，可先设置镜像环境变量再打包：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
npm run dist
```

## 🔑 各平台 Key 获取方式

| 平台       | 获取位置                                                 | 权限要求                                                     |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| DeepSeek   | platform.deepseek.com → API Keys                         | 普通 key 即可查余额                                          |
| OpenAI     | platform.openai.com → API keys                           | 查询用量建议用组织设置里创建的 **Admin key**（`sk-admin-...`） |
| Anthropic  | console.anthropic.com → Organization settings → API Keys | **Admin 角色**才能查用量/成本                                |
| 阿里云百炼 | 阿里云控制台 → RAM 访问控制 → 创建用户并生成 AccessKey   | RAM 用户授予 `AliyunBSSReadOnlyAccess` 权限                  |
| 智谱 GLM   | open.bigmodel.cn → API 密钥                              | 普通 key（后付费）                                           |
| 硅基流动   | cloud.siliconflow.cn → API 密钥                          | 普通 key 即可查余额                                          |

## ➕ 自定义平台

点击顶部「⚙️ 自定义平台」→「＋ 新增自定义平台」即可接入任意 API 服务：

### 模式一：OpenAI 兼容（推荐）

适用于 new-api、one-api、FastGPT 中转等一切实现了 OpenAI 计费接口（`/dashboard/billing/subscription` 与 `/usage`）的服务。
只需填写：

- **平台名称**：任意备注
- **Base URL**：如 `https://your-gateway.com/v1`
- 添加账号时填写该服务的 API Key

### 模式二：完全自定义 REST

适用于有独立余额/用量查询接口的服务，可配置：

| 配置项           | 说明                                                        |
| ---------------- | ----------------------------------------------------------- |
| 认证方式         | Bearer Token / 自定义 Header（如 `X-API-Key`）/ 无认证      |
| 余额接口 URL     | GET 请求地址，如 `https://api.example.com/api/user/balance` |
| 余额值 JSON 路径 | 如响应为 `{"data":{"balance":12.5}}` 则填 `data.balance`    |
| 币种 JSON 路径   | 可选，如 `data.currency`                                    |
| 用量接口 URL     | 可选，查询用量                                              |
| 用量值 JSON 路径 | 如 `data.total_tokens`                                      |

> JSON 路径支持点号与数组索引：`data.balance`、`data.0.value`。
> 添加账号时填写的 Key 会按所选认证方式自动附加到请求头。
> 删除自定义平台时，其下所有账号会一并删除。

## 🔐 网页登录方式（查看官网余额/用量）

部分平台官方 API 不提供用量/余额接口（DeepSeek 用量、硅基流动、智谱等），
可通过「网页登录」方式接入：添加账号时选择接入方式为**网页登录**。

### DeepSeek（支持自动登录）

- **自动登录**：填写官网邮箱 + 密码，应用调用官方登录接口获取会话，自动查询**余额**（get_user_summary）、**本月用量**（usage/amount）与**本月消费**（usage/cost）
- **粘贴 userToken（推荐，最稳定）**：浏览器登录 platform.deepseek.com → F12 → Console → 输入
  `localStorage.getItem('userToken')` → 回车 → 复制结果粘贴到「userToken」栏
- Cookie 兜底：粘贴 Cookie，应用自动尝试从中解析 userToken

### 其他平台（通用网页抓取）

OpenAI / Anthropic / 阿里云百炼 / 智谱 / 硅基流动均因**登录风控、二步验证或接口非公开**无法自动登录。
页面提供「高级选项」：粘贴 Cookie/Token 后自行配置**数据接口 URL + JSON 路径**（在浏览器开发者工具 Network 面板抓取控制台接口）。
其中 OpenAI、Anthropic、阿里云强烈建议改用 **API Key / AccessKey 方式**（本应用已内置完整查询）。

> ⚠️ 网页数据接口为各平台私有接口，可能随官方改版失效，失效时请以官网控制台为准。
> 网页登录凭证（邮箱/密码/Cookie/Token）与 API Key 一样使用系统加密存储，仅保存在本机。

## 🪟 悬浮小窗

顶栏「🪟 悬浮窗」按钮或设置中可开启。悬浮小窗始终置顶在屏幕最前方，显示所有账号的余额摘要：

- 顶部标题栏可**拖动**移动窗口位置
- 🔄 按钮可立即刷新所有余额
- 📋「主窗口」按钮一键返回主界面
- 数据随自动刷新同步更新（若开启了实时更新）
- 右键托盘图标也可显示/隐藏悬浮窗

## ⏱️ 实时更新（自动刷新）

在设置中开启后，应用会按设定间隔（30 秒 / 1 分钟 / 5 分钟 / 10 分钟 / 30 分钟）自动查询所有账号余额，主窗口与悬浮窗同步更新数据。主窗口账号列表右上角会显示上次刷新时间。

## 📥 系统托盘

应用启动后会在系统托盘（右下角任务栏通知区域）显示图标。右键图标可：显示主窗口、显示/隐藏悬浮窗、立即刷新、退出。

设置中可配置：

- **最小化时隐藏到托盘**：点最小化按钮时窗口隐藏到托盘，不占任务栏
- **关闭按钮 = 最小化到托盘**：点窗口右上角 ✕ 时最小化到托盘而不退出（要退出请用托盘菜单的「退出」）

## 🎨 外观与背景

顶栏「⚙️ 设置 → 背景」：

- **6 套预设**：默认深色 / 海洋蓝 / 日落橙 / 紫罗兰 / 森林绿 / 极光，点击即切换
- **自定义图片**：选择本地图片作为背景（复制保存到本机 userData，自动加暗色遮罩），支持随时移除
- 设置保存在 `%APPDATA%\ai-api-balance-monitor\config.json` 的 `settings` 中，重启后保持

## 💰 充值

每个账号卡片上的「💰 充值」按钮会打开系统浏览器跳转到该平台官网充值/计费页面
（DeepSeek 充值页、OpenAI 计费、Anthropic Billing、阿里云资金管理、智谱账户中心、硅基流动计费，均已在入口内置并验证可用）。

## 📁 数据存储位置

账号与密钥保存在 Electron `userData` 目录下的 `config.json`：

```
Windows: %APPDATA%\ai-api-balance-monitor\config.json
```

- 密钥字段以 `safeStorage` 加密后的 base64 存储（`{"method":"safe","data":"..."}`）
- 若系统不支持加密（如部分 Linux 无 keyring），自动降级为 base64 编码并将在界面提示

删除账号时会从配置文件中彻底移除。

## ❓ 常见问题

**查询显示 401 / Authentication Fails**
→ API Key 无效或已过期，请到对应平台控制台检查。

**OpenAI 用量查询失败**
→ 普通项目 Key 无法访问用量接口。请在组织设置中创建具有 Admin 角色的 Key（`sk-admin-...`）后编辑账号替换。

**Anthropic 查询失败**
→ 必须使用**管理员角色**的 API Key。普通 key 只能发消息，不能查用量。

**阿里云报错 "NoPermission"**
→ RAM 用户的权限不足，需在 RAM 控制台为该用户添加 `AliyunBSSReadOnlyAccess` 权限。

**智谱只显示连通性检查**
→ 智谱为后付费计费，官方未开放余额查询 API，属正常现象。

**首次启动提示"系统无加密能力"**
→ Windows 上不会出现；如出现说明 safeStorage 不可用，密钥将以编码形式存储，请谨慎保管本机文件。

## 🏗️ 技术架构

```
src/
├── main.js               # Electron 主进程：窗口 + IPC + 外部链接守卫
├── preload.js            # contextBridge 安全桥接
├── config.js             # 配置存储（safeStorage 加密 + 脱敏列表）
├── providers/            # 各平台查询实现
│   ├── index.js          #   平台注册表 + 统一入口
│   ├── http.js           #   fetch 封装 + 防御性解析工具
│   ├── deepseek.js       #   GET /user/balance
│   ├── openai.js         #   dashboard billing + 组织级用量双路径
│   ├── anthropic.js      #   usage_report（message_usage + cost_report）
│   ├── aliyun.js         #   BSS OpenAPI QueryAccountBalance（HMAC-SHA1 签名）
│   ├── zhipu.js          #   Key 连通性检查 + 计费指引
│   └── siliconflow.js    #   GET /v1/user/info
└── renderer/             # 渲染进程（原生 HTML/CSS/JS，无框架依赖）
    ├── index.html
    ├── style.css
    └── renderer.js
```

**安全设计**：渲染进程与主进程完全隔离（`contextIsolation: true`、`nodeIntegration: false`），
所有外链强制交给系统浏览器打开；API Key 明文永不进入渲染进程。

## 📄 测试

```bash
node tools/smoke.js      # Provider 冒烟测试（平台注册/签名/接口错误处理）
node tools/test-custom.js # 自定义平台单元测试（JSON 路径解析/配置构建/异常分支）
node tools/test-web.js    # 网页登录模块测试（凭证解析/响应解析/自动登录链路）
node tools/test-token.js  # Token 聚合与成本估算单元测试
node tools/test-history.js # 历史记录模块测试（数值解析/存储/超限裁剪）
node_modules\.bin\electron.cmd tools\gui-check.js   # GUI 渲染诊断（含内置教程加载验证）
node_modules\.bin\electron.cmd tools\e2e.js         # 端到端流程测试（独立临时配置目录）
```

## ⚠️ 免责声明

本项目为个人工具，与上述各平台无官方关联。各平台接口可能随官方调整而变化，
查询结果请以各平台官网控制台数据为准。
