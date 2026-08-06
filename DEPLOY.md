# Deploy

O sistema roda em <https://financeiro.gamo.net.br>, num container gerenciado
pelo **Coolify**. Todo o caminho da sua máquina até o ar é automático: o único
gesto manual é o push.

```
você edita o código
        │
        ▼  git push origin main
GitHub Actions  (.github/workflows/docker-build.yml)
        │  1. builda a imagem Docker
        │  2. publica em ghcr.io/moredo88/financeiro:latest
        │  3. chama a webhook de deploy do Coolify
        ▼
Coolify (na VPS)  baixa a imagem pronta e reinicia o container
        │
        ▼
financeiro.gamo.net.br
```

## Como publicar

```powershell
git push origin main
```

Só isso. Leva cerca de 2 minutos até o ar.

Se quiser acompanhar até a confirmação, rode o script a partir da raiz do
repositório:

```powershell
.\deploy.ps1
```

Ele empurra, espera o workflow terminar e fica comparando o site até o
conteúdo mudar de fato — então você sabe que o deploy chegou ao fim, em vez
de supor. Se o workflow passar mas o site não mudar, ele avisa: nesse caso o
problema está no Coolify, não no build.

O script **não commita sozinho.** Se houver mudança pendente, ele para e
lista o que falta. Um commit automático mandaria ao ar código que ninguém
revisou.

## Configuração

### Secrets do repositório

Ficam em **Settings → Secrets and variables → Actions**. O repositório é
público, então nada disso pode ir para dentro de arquivo:

| Secret | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | embutido no bundle durante o build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |
| `COOLIFY_DEPLOY_URL` | webhook de deploy do recurso no Coolify |
| `COOLIFY_TOKEN` | API token do Coolify (opcional — ver abaixo) |

As duas variáveis `NEXT_PUBLIC_*` precisam existir **no momento do build**,
não só em runtime: o Next.js as embute no JavaScript que vai para o
navegador. Por isso o `Dockerfile` as recebe como `ARG`.

`COOLIFY_TOKEN` é opcional. A API v1 do Coolify exige `Authorization: Bearer`,
mas webhooks simples por recurso funcionam sem autenticação — o passo do
workflow monta o cabeçalho só quando o secret existe.

### Onde achar os valores do Coolify

No painel, dentro do recurso do financeiro: a URL fica em **Webhooks** (formato
`https://coolify.gamo.net.br/api/v1/deploy?uuid=...`), e o token em
**Keys & Tokens → API tokens**.

## Quando algo dá errado

**O workflow ficou vermelho.** Veja qual passo caiu:

```powershell
gh run list --branch main --limit 3
gh run view <id> --log-failed
```

Se o passo `Trigger Coolify deploy` falhou, a imagem **foi publicada** — o que
não aconteceu foi o aviso ao Coolify. Dá para destravar clicando em *Redeploy*
no painel, sem precisar buildar de novo.

**O workflow passou mas o site não mudou.** O build está no GHCR e o Coolify
recebeu o gatilho, então a falha é ao subir o container: veja o log do
deployment no painel do Coolify.

**Conferir o que está no ar.** O `ETag` do HTML muda a cada build:

```powershell
curl -sI https://financeiro.gamo.net.br/login | Select-String -Pattern '^etag'
```

Compare antes e depois de um deploy — se o valor não mudou, a versão antiga
ainda está sendo servida.

## Ambiente local

O `.env.local` (que tem o `SUPABASE_SERVICE_ROLE_KEY`) está no `.gitignore` e
nunca foi commitado. Ele não é usado no deploy: em produção as variáveis vêm
do Coolify e dos secrets do GitHub.

```powershell
npm install
npm run dev
```
