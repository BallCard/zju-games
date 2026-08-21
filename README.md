# zju-games

| 项目状态 | 用途 | 入口 | 验证命令 | 下一步 |
| --- | --- | --- | --- | --- |
| `archived` | 保存浙大校园主题合成小游戏及最终猫咪素材 | `apps/web/` | `npm run typecheck && npm run lint && npm run build` | 仅供展示或恢复 |

浙大校园轻量小游戏项目 Monorepo。

## 目录
- `apps/web`：React + Vite + PixiJS 前端
- `apps/server`：NestJS 风格后端
- `packages/shared`：共享 DTO/枚举/常量

## 快速开始
```bash
pnpm install
pnpm dev
```

## 常用命令
```bash
pnpm build
pnpm lint
pnpm typecheck
```

## 归档说明

当前归档包含 12 级猫咪配置、最终静态猫咪素材、10-12 级动画条带及其源帧，以及对应的游戏逻辑修改。依赖目录、构建输出和临时 checkpoint ZIP 不属于归档。

- 项目过程：[`docs/PROJECT_STORY.md`](docs/PROJECT_STORY.md)
- 验收与边界：[`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md)
