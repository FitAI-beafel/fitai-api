# Comandos e fluxo de trabalho – fitai-api

## Comandos principais

**Instalação de dependências**

- `pnpm install`
  - Instala dependências e roda scripts de build necessários (Prisma, esbuild).
  - `package.json` configura `pnpm.onlyBuiltDependencies` para permitir scripts de `@prisma/engines`, `prisma`, `esbuild`.

**Banco de dados (PostgreSQL via Docker)**

- `docker compose up -d`
  - Sobe container Postgres 16 com DB `fitai-api` em `localhost:5432`.
- Variáveis de ambiente esperadas (`.env` na raiz):
  - `PORT=8081`
  - `DATABASE_URL="postgresql://postgres:password@localhost:5432/fitai-api"`

**Prisma**

- `pnpm prisma db push`
  - Sincroniza o `prisma/schema.prisma` com o banco (cria/atualiza tabelas).
- `pnpm prisma generate`
  - Gera o Prisma Client em `src/generated/prisma`.

**Servidor de desenvolvimento**

- `pnpm dev`
  - Executa `tsx --watch src/index.ts`.
  - Sobe o servidor Fastify em `http://localhost:8081`.

## Entrypoints HTTP

- `GET /`
  - Healthcheck simples: `{ "message": "Hello World" }`.
- `GET /swagger.json`
  - OpenAPI da Fit.AI API.
- `GET /docs`
  - UI do Scalar API Reference consumindo `/swagger.json` e OpenAPI da Auth API.
- `POST /workout-plans`
  - Criar/ativar um plano de treino (rota registrada com prefixo `/workout-plans` via `workoutPlanRoutes`).
  - Body esperado: `WorkoutPlanSchema.omit({ id: true })` (veja `src/schemas`).
- `GET|POST /api/auth/*`
  - Proxy para o handler do Better Auth (`auth.handler`).
  - Usado pela aplicação front para login, registro, etc.

## Fluxo típico de desenvolvimento

1. **Preparar ambiente**
   - Criar `.env` com `DATABASE_URL` e `PORT`.
   - Rodar `docker compose up -d` para subir o Postgres.
   - Rodar `pnpm install`.
   - Rodar `pnpm prisma db push` e `pnpm prisma generate`.

2. **Rodar a API**
   - `pnpm dev`.
   - Testar `GET /` e acessar `/docs` no navegador.

3. **Desenvolver uma feature**
   - Modelar entidades no `prisma/schema.prisma` (se necessário).
   - Rodar `pnpm prisma db push` e `pnpm prisma generate` após mudança de schema.
   - Adicionar/ajustar usecase em `src/usecases`.
   - Declarar schemas Zod em `src/schemas`.
   - Registrar novas rotas em `src/routes` e conectá-las em `src/index.ts`.

4. **Após concluir uma tarefa**
   - Garantir que `pnpm dev` não acusa erros de runtime.
   - Rodar `pnpm prisma db push`/`generate` se o schema mudou.
   - (Quando houver scripts) rodar lint / testes (ver próximo arquivo de memória específico de lint/testes quando existir).

## Utilitários de sistema (Windows)

- Navegação e arquivos:
  - `cd`, `dir`, `type` (PowerShell/Prompt), mas na prática usamos comandos via pnpm e Docker.
- Git:
  - `git status`, `git diff`, `git add`, `git commit`, `git log` para versionamento.
