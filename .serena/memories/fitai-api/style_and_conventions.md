# Estilo e convenções – fitai-api

## TypeScript e módulos

- Projeto em modo **ESM**:
  - `"type": "module"` no `package.json`.
  - `tsconfig.json` com `"module": "nodenext"`, `"moduleResolution": "nodenext"`, `"target": "es2024"`.
- Imports devem usar **extensão `.js`** para arquivos locais (ex.: `./lib/auth.js`, `../usecases/CreateWorkoutPlan.js`).
- Código escrito em TypeScript, mas o caminho de import reflete o arquivo gerado `.js`.
- `strict: true` e `skipLibCheck: true` no TypeScript.

## Organização de código

- `src/index.ts`: composição de servidor (Fastify, Swagger, docs, CORS, rotas raíz e proxy de auth).
- `src/routes/*`: rotas HTTP específicas (ex.: `workout-plan.ts`).
- `src/usecases/*`: casos de uso de domínio (ex.: `CreateWorkoutPlan`).
- `src/schemas/*`: schemas Zod centralizados (request/response + schemas de erro reutilizáveis).
- `src/lib/*`: infraestrutura compartilhada (ex.: `db.ts` para Prisma, `auth.ts` para Better Auth).
- `src/errors/*`: erros de domínio (`NotFoundError`, etc.).
- `prisma/schema.prisma`: única fonte de verdade de modelos de banco.

## Padrões de design

- **Use cases**: classes como `CreateWorkoutPlan` encapsulam regras de negócio e transações Prisma.
- **DTOs e schemas**:
  - Use cases tipam input e output via interfaces TypeScript.
  - Rotas expõem schemas Zod (`WorkoutPlanSchema`, `ErrorSchema`) e não vazam entidades Prisma diretamente.
- **Auth cross‑cutting**:
  - Autenticação feita antes da chamada ao use case (`auth.api.getSession`).
  - `userId` é extraído da sessão e passado ao use case.
- **Transações**:
  - Operações multi‑passo (desativar plano antigo + criar novo plano ativo) usam `prisma.$transaction`.

## Naming

- Classes: `PascalCase` (ex.: `CreateWorkoutPlan`).
- Interfaces/types: `PascalCase` com sufixos descritivos (`InputDto`, `CreateWorkoutPlanOutput`).
- Variáveis e funções: `camelCase` (`workoutPlanRoutes`, `workoutDays`).
- Pastas: `kebab-case` ou `lowercase` (`usecases`, `schemas`, `routes`).

## Estilo de validação/API

- Rotas Fastify usam `withTypeProvider<ZodTypeProvider>()` e schemas Zod.
- Respostas tipadas por status (201/400/401/404/500) com objetos Zod definidos em `src/schemas`.
- Corpo da rota `POST /workout-plans` baseado em `WorkoutPlanSchema.omit({ id: true })` para request e `WorkoutPlanSchema` para resposta.

## Erros e tratamento

- Erros de domínio específicos (`NotFoundError`) tratados nos handlers de rota e convertidos em 404.
- Demais exceções: 500 com payload `{ error: string, code: "INTERNAL_SERVER_ERROR" }`.
- Logs via `app.log.error(error)` do Fastify.

## Ferramentas de qualidade

- ESLint + `@eslint/js` + `typescript-eslint` + `eslint-config-prettier` configurados em `eslint.config.js`.
- Prettier 3.x para formatação.
- Convencional usar `pnpm` para rodar scripts de lint/format (quando adicionados).

## Boas práticas específicas

- Não editar código gerado em `src/generated/prisma/*`.
- Após alterar `schema.prisma`, sempre rodar:
  - `pnpm prisma db push`
  - `pnpm prisma generate`
- Manter coherence entre schema Zod de resposta e tipo retornado pelos usecases (não retornar objetos Prisma crus na API pública).
