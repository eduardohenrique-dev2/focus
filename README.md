# FOCUS

Sistema pessoal para organizar tarefas, notas, hábitos, calendário, projetos, estudos, finanças, lembretes e automações.

## Tecnologias

O projeto usa diretamente:

- React + TypeScript
- TanStack Start / Router
- banco local no navegador para desenvolvimento
- Supabase como backend opcional para produção futura
- Tailwind CSS
- Vite
- Cloudflare Vite Plugin para o build/deploy atual

O projeto não depende mais de pacotes, autenticação ou configuração da Lovable.

## Rodar agora no computador

1. Instale Node.js 22.12 ou superior.
2. Na pasta do projeto, inicie normalmente:

```bash
npm run dev
```

Se as dependências ainda não estiverem instaladas nessa cópia do projeto, rode `npm install` uma vez.

### Banco local

Você **não precisa criar `.env` nem configurar Supabase** para desenvolver localmente.

Sem as variáveis do Supabase, o FOCUS entra automaticamente no modo local e salva os dados no `localStorage` do navegador. Tarefas, notas, projetos, finanças e os demais registros ficam no computador/navegador onde foram criados.

Uma sessão local é criada automaticamente para permitir usar as telas autenticadas durante o desenvolvimento.

> Importante: limpar os dados do navegador/site também apaga esse banco local. Ele é indicado para desenvolvimento e testes, não para produção multiusuário.

## Escolher o backend

O modo pode ser controlado por:

```env
VITE_DATA_BACKEND=local
```

ou:

```env
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://seu-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
```

Também existe `auto`: se houver URL/chave do Supabase usa Supabase; caso contrário usa o banco local.

## Futuro: Vercel + Supabase

Quando chegar a hora de publicar:

1. criar/configurar o projeto no Supabase;
2. aplicar as migrations existentes em `supabase/migrations`;
3. configurar no Vercel `VITE_DATA_BACKEND=supabase`;
4. configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`;
5. manter as políticas RLS por usuário.

As telas continuam usando o mesmo cliente de dados, então a troca do modo local para Supabase fica concentrada na camada de integração.

## Verificações

Antes de enviar alterações para produção:

```bash
npm run lint
npm run build
```

## Segurança

- Nunca envie o arquivo `.env` real para o GitHub.
- O banco local não deve guardar dados sensíveis de produção.
- No Supabase, a chave publicável/anon pode ficar no frontend; a segurança dos registros depende das políticas RLS.

## Independência da Lovable

Foram removidos:

- `@lovable.dev/cloud-auth-js`
- `@lovable.dev/vite-tanstack-config`
- `src/integrations/lovable`
- configuração específica da Lovable no `vite.config.ts`
- exceção da Lovable no `bunfig.toml`
- lockfiles antigos que ainda continham pacotes transitivos da Lovable

O modo local não depende da Lovable nem do Supabase para iniciar o sistema.
