# CLAUDE.md

Tech Stack:
- Frontend: React 19.1 + TypeScript + Vite + PixiJS + Tailwind
- Backend: NestJS + Prisma + PostgreSQL + Redis
- Monorepo: pnpm workspace + Turborepo

Code Rules:
- All UI components go in `apps/web/src/components/`
- All game logic modules go in `apps/web/src/game/`
- All API routes/controllers go in `apps/server/src/modules/`
- Never use inline styles, always use Tailwind tokens
- Mobile-first responsive approach

Design Tokens:
- Primary: `#005BAC`
- Background: `#F6FAFF`
- Accent: `#00A870`
- Spacing: 4px multiples

Reference Docs:
- `PRD.md`
- `APP_FLOW.md`
- `TECH_STACK.md`
- `FRONTEND_GUIDELINES.md`
- `BACKEND_STRUCTURE.md`
- `IMPLEMENTATION_PLAN.md`

Session Rules:
1. Read `progress.txt` at the start of every session
2. Update `progress.txt` after completing any feature
3. Review `lessons.md` at session start
4. Update `lessons.md` after every correction
