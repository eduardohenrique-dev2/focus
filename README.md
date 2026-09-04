# FOCUS

Sistema pessoal para organizar tarefas, notas, hábitos, calendário, projetos, estudos, finanças, lembretes e automações.

## Tecnologias

O projeto usa:

- React + TypeScript
- TanStack Start / Router
- Supabase (login e banco de dados)
- Tailwind CSS
- Vite

A estrutura atual foi mantida porque trocar tudo por HTML/CSS/JavaScript puro de uma vez aumentaria o risco de quebrar autenticação, banco, rotas e deploy. As correções estão sendo feitas deixando o código mais simples e direto sempre que possível.

## Rodar no computador

1. Instale Node.js 20 ou superior.
2. Na pasta do projeto, instale as dependências:

```bash
npm install
```

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
