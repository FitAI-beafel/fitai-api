# Estrutura e módulos principais – fitai-api

**Raiz do projeto**
- `.gitignore`, `.npmrc`, `eslint.config.js`, `tsconfig.json`, `pnpm-lock.yaml` etc.
- `package.json`: scripts, dependências, engines, config do pnpm.
- `docker-compose.yml`: PostgreSQL 16 local.
- `prisma.config.ts`: configuração do Prisma (schema + migrations + URL de datasource).
- `prisma/schema.prisma`: modelos de domínio e tabelas de auth.
- `src/`: código-fonte TypeScript.

**`prisma/schema.prisma` (domínio)**
- `User`: dados de usuário + métricas de treino (peso, altura, idade, % gordura).
- `WorkoutPlan`: plano de treino, relacionado a `User`, com `workoutDays`, `isActive`, timestamps.
- `WorkoutDay`: dia do treino (nome, `weekDay`, `isRest`, `estimatedDurationInSeconds`, `coverImageUrl?`, relação com `WorkoutPlan`, `sessions`).
- `WorkoutExercise`: exercícios por dia (order, sets, reps, restTimeInSeconds, timestamps).
- `WorkoutSession`: sessões de treino (start/complete, timestamps, relação `WorkoutDay`).
- `Session`, `Account`, `Verification`: modelos de auth do Better Auth/Prisma.

**`src/index.ts`**
- Configura Fastify + Zod type provider.
- Registra Swagger (`@fastify/swagger`) e Scalar (`@scalar/fastify-api-reference`) com fontes `/swagger.json` e `/api/auth/open-api/generate-schema`.
- Registra CORS com `origin: ["http://localhost:3000"]` e `credentials: true`.
- Registra rotas de workout com `await app.register(workoutPlanRoutes, { prefix: "/workout-plans" });`.
- Define rota `GET /swagger.json` (retorna `app.swagger()`).
- Define rota `GET /` (Hello World).
- Define rota catch‑all `/api/auth/*` que translate o request para `auth.handler` do Better Auth.
- Inicia o servidor na porta `PORT` ou 8081.

**`src/routes/workout-plan.ts`**
- Exporta `workoutPlanRoutes(app: FastifyInstance)`.
- Usa `ZodTypeProvider`.
- Rota `POST /` (prefixo `/workout-plans` configurado no `index.ts`).
  - `body`: `WorkoutPlanSchema.omit({ id: true })` (schema central em `src/schemas`).
  - `response`: 201 = `WorkoutPlanSchema`; 400/401/404/500 = `ErrorSchema`.
  - Handler:
    - Recupera sessão via `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })`.
    - Se não houver sessão → 401 UNAUTHORIZED.
    - Chama `new CreateWorkoutPlan().execute(...)` com `userId` da sessão e o body.
    - 201 → resposta com o resultado do use case.
    - 404 se `NotFoundError`, 500 genérico para demais erros.

**`src/usecases/CreateWorkoutPlan.ts`**
- Implementa o caso de uso de criação/ativação de plano de treino.
- Pipeline:
  - Busca plano ativo existente para o usuário.
  - Transação Prisma: se existir, marca o atual como `isActive = false`.
  - Cria novo `WorkoutPlan` com `workoutDays` e `exercises` a partir do DTO.
  - Faz `findUnique` carregando `workoutDays` + `exercises`.
  - Mapeia o resultado para `CreateWorkoutPlanOutput` (id, name, workoutDays com campos esperados pelo schema da API).

**`src/lib/db.ts`**
- Configura `PrismaClient` com `PrismaPg` adapter usando `DATABASE_URL`.
- Usa um singleton global para evitar múltiplas conexões em dev.

**`src/lib/auth.ts`**
- Configura o `betterAuth` com:
  - `trustedOrigins: ["http://localhost:3000"]`.
  - `emailAndPassword.enabled = true`.
  - `database: prismaAdapter(prisma, { provider: "postgresql" })`.
  - Plugin `openAPI()` para expor schema OpenAPI da auth API.

**`src/errors`**
- Define erros de domínio como `NotFoundError` (já usado nas rotas de workout).

**`src/schemas`**
- Conjunto de schemas Zod centralizados (`WorkoutPlanSchema`, `ErrorSchema`, etc.), compartilhados entre rotas e usecases.

**`src/generated/prisma`**
- Código gerado pelo Prisma Client para os modelos do schema (não deve ser editado manualmente).
