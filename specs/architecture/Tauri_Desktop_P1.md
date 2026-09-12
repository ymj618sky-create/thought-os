# Tauri 桌面壳（Desktop Shell）P1 · ADR



> **Copyright © 2026 Mingjie Ye. Licensed under CC BY 4.0.**
>
> 本文档是 Thought OS 的开放规范资产（Open Specification），采用知识共享署名 4.0 国际许可协议（CC BY 4.0）。
> 你可以复制、再发布、修改、商业使用，并基于本规范实现自己的系统，但须适当署名并注明是否修改。
> 许可全文见仓库根 `LICENSE-DOCS`；实现代码另受 `LICENSE-CODE`（MIT）约束。
> 许可边界见仓库根目录 `LICENSE`、`LICENSE-DOCS`。
- 状态：Phase 2 · 脚手架已就位（未在此环境编译，需 Rust 工具链）
- 范围：把现有 Hono Web 参考实现包成桌面应用
- 决策依据：复用 Web 实现，避免重复开发原生 UI

## 1. 目标

Phase 1 是「Web 参考实现」。P1 用 **Tauri v2**（Rust + 系统 WebView）把它包成桌面 App，
让用户在本地拥有独立窗口、本地数据、本地算力，同时**复用全部已实现的 Web UI 与后端**。

## 2. 决策

- **Tauri v2** 而非 Electron：更小的包体、原生 WebView、Rust 后端可逐步暴露本地能力。
- **不内嵌服务器二进制**（P1）：开发期 WebView 直接指向已运行的 Hono 服务
  `http://127.0.0.1:3000`；`beforeDevCommand` 会自动拉起 `npm run web`。
- **复用同一份本地 SQLite**：桌面壳与 Web 模式共享 `mirror.db` 与加密 / Sync 配置
  （通过 `.env` 或环境变量传入），不存在「两套数据」。

## 3. 目录结构

```(Mirror reference product)```

## 4. 运行

```bash
# 方式一：一步到位（Tauri 会先拉起 web 服务）
npm run tauri:dev

# 方式二：分开
npm run web          # 终端 A：Hono 服务
npm run tauri dev    # 终端 B：桌面壳
```

## 5. 与 Phase 2 其他特性的关系

- **加密 P2**：桌面壳沿用 `MIRROR_ENCRYPTION` / `MIRROR_MASTER_PASSWORD`，解锁流程不变。
- **Sync §3.4**：桌面壳可触发 `POST /api/sync/push|pull`，与 Web 模式共用同一同步引擎。
- **Pro 托管推理**：若启用，桌面壳也走 `PRO_INFERENCE_URL`（Article 4 授权边界一致）。

## 6. 未决 / 后续阶段

- **生产打包**：`tauri build` 需先生成图标（`npm run tauri icon`），并决定如何把 Node 运行时
  作为 sidecar 内嵌，使最终安装包可独立运行（不依赖用户本机装 Node）。
- **原生能力**：系统托盘、全局快捷键、自动后台同步、文件导入系统对话框——留待 P2+。
- **编译**：本环境未安装 Rust 工具链，脚手架未经编译验证；接口与配置已对齐 Tauri v2。
