# FOCUS

Sistema pessoal para organizar tarefas, notas, hábitos, calendário, projetos, estudos, finanças, lembretes e automações.

## Tecnologias

O projeto usa diretamente:

- React + TypeScript
- TanStack Start / Router
- Supabase (login e banco de dados)
- Tailwind CSS
- Vite
- Cloudflare Vite Plugin para o build/deploy atual

O projeto não depende mais de pacotes, autenticação ou configuração da Lovable. O Vite usa os plugins oficiais do TanStack Start, React, Tailwind, Cloudflare e `vite-tsconfig-paths`.

## Rodar no computador

1. Instale Node.js 22.12 ou superior.
2. Na pasta do projeto, instale as dependências:

```bash
npm install
```

O primeiro `npm install` após a remoção da Lovable vai gerar um novo `package-lock.json` limpo.

3. Crie seu arquivo de ambiente:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

4. Preencha o `.env` com a URL e a chave publicável do seu projeto Supabase.
5. Inicie o sistema:

```bash
npm run dev
```

## Verificações

Antes de enviar alterações para produção:

```bash
npm run lint
npm run build
```

## Segurança

- Nunca envie o arquivo `.env` real para o GitHub.
- Configure as mesmas variáveis de ambiente na plataforma de deploy.
- A chave publicável/anon do Supabase é usada pelo frontend; a segurança dos dados continua dependendo das políticas RLS do Supabase.

## Banco de dados

As migrations ficam em `supabase/migrations`.

O sistema já possui políticas RLS por usuário nas tabelas principais. Mesmo assim, as telas também filtram explicitamente os registros pelo usuário autenticado para deixar o comportamento mais previsível.

## Independência da Lovable

Foram removidos:

- `@lovable.dev/cloud-auth-js`
- `@lovable.dev/vite-tanstack-config`
- `src/integrations/lovable`
- configuração específica da Lovable no `vite.config.ts`
- exceção da Lovable no `bunfig.toml`
- lockfiles antigos que ainda continham pacotes transitivos da Lovable

O login atual funciona diretamente pelo Supabase.
