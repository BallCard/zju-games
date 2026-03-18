# 技术栈锁定

## 前端
- `React 19.1`
- `TypeScript 5.7`
- `Vite 6`
- `Tailwind CSS 4`
- `PixiJS 8`（2D 渲染）
- `Zustand 5`（轻量状态管理）
- `TanStack Query 5`（服务端状态）

## 后端
- `Node.js 22 LTS`
- `NestJS 11`
- `TypeScript 5.7`
- `Prisma 6`
- `PostgreSQL 16`
- `Redis 7`（排行榜缓存、限流、任务队列）
- `BullMQ 5`（异步任务）

## 鉴权与身份
- 匿名账号体系（设备 ID + 随机 UID）
- JWT Access Token + Refresh Token
- 可选微信静默登录升级（后续）

## 部署
- 前端：Vercel（H5）
- 后端：Docker + Render/Fly.io（起步）或阿里云 ECS（进阶）
- 数据库：Neon/Supabase Postgres（起步）+ Redis Cloud
- 对象存储：S3 兼容（战绩卡片、静态资源）

## 工程与质量
- Monorepo：`pnpm workspace + Turborepo`
- Lint：`ESLint 9`
- Format：`Prettier 3`
- Test：`Vitest + Playwright + Jest`
- CI：GitHub Actions

## 开源架构参考（用于优化制作）
- Phaser/Pixi 社区的 2D 小游戏渲染与资源加载模式
- Colyseus 的实时房间与状态同步设计思路（排行榜/活动可借鉴）
- 开源 idle/merge 类游戏的经济系统与关卡参数配置模式（以数据驱动表为核心）
