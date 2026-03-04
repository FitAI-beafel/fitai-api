# Projeto fitai-api – propósito e stack

**Propósito**
- API backend para o bootcamp de treinos ("Bootcamp Treinos API" / Fit.AI).
- Focada em gestão de planos de treino (`WorkoutPlan`, `WorkoutDay`, `WorkoutExercise`, `WorkoutSession`) e autenticação de usuários.
- Fornece uma API documentada via Swagger/Scalar (`/swagger.json`, `/docs`) e endpoints de auth via Better Auth.

**Stack principal**
- **Linguagem**: TypeScript (ES modules, `module: "nodenext"`, `target: es2024`).
- **Runtime**: Node.js 24.x.
- **Gerenciador de pacotes**: pnpm 10.x (configurado em `package.json`).
- **Servidor HTTP**: Fastify 5.x.
- **Validação/Tipagem HTTP**: `fastify-type-provider-zod` + Zod.
- **ORM/DB**: Prisma 7.4.0 com PostgreSQL (via `@prisma/adapter-pg`).
- **Auth**: `better-auth` 1.4.18 com `prismaAdapter` e plugin `openAPI`.
- **Docs de API**: `@fastify/swagger` + `@scalar/fastify-api-reference`.
- **Infra local**: PostgreSQL 16 (Docker, `docker-compose.yml`).

**Entrypoint**
- `src/index.ts`
  - Cria a instância Fastify.
  - Registra Swagger/OpenAPI e o Scalar API Reference (`/docs`).
  - Registra CORS para `http://localhost:3000`.
  - Registra rotas de workout (`workoutPlanRoutes`) com prefixo `/workout-plans`.
  - Registra proxy de auth em `/api/auth/*` usando `auth.handler` do Better Auth.
  - Sobe o servidor na porta `process.env.PORT || 8081`.
