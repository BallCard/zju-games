# 浙大校园小游戏

- 项目已归档，先读 [README](./README.md) 与验收记录；恢复工作须有具体需求。
- 前端入口为 `apps/web/src/App.tsx`，Phaser 玩法在 `MainScene.ts`，嵌入组件在 `PhaserGame.tsx`（均在该 src 目录）。
- 技术选型和命令以各 package.json 为准；根工作区声明 npm@11.9.0，不沿用旧 pnpm 或完整后端介绍。
- UI 使用 Tailwind tokens、移动优先；主色 `#005BAC`、背景 `#F6FAFF`、强调色 `#00A870`，间距为 4px 倍数。
- 玩法与设计细节按需读 PRD、APP_FLOW、FRONTEND_GUIDELINES 和 BACKEND_STRUCTURE。
- 改玩法或素材后验证类型、lint 与构建；保留最终猫咪素材、动画源帧和已有本地改动。
- 只在实际状态或关键经验变化时更新 progress/lessons，不执行旧会话中的固定阶段计划。
