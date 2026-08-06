#Requires -Version 5.1
<#
  Deploy do sistema financeiro (financeiro.gamo.net.br).

    voce edita o codigo  ->  git push origin main
                                  |
                        GitHub Actions builda a imagem, publica em
                        ghcr.io/moredo88/financeiro:latest e chama a
                        webhook de deploy do Coolify
                                  |
                        Coolify baixa a imagem pronta e reinicia
                                  |
                        financeiro.gamo.net.br

  Um `git push origin main` sozinho ja dispara tudo isso. Este script
  existe para acompanhar: ele empurra, espera o workflow e so termina
  quando confirma que o site no ar mudou de fato.

  Nao precisa de SSH nem de segredo local: quem mexe no container e o
  Coolify, e as credenciais vivem nos secrets do repositorio.

  Pre-requisitos: git, gh CLI autenticado (gh auth status).

  Uso:  .\deploy.ps1
#>

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ── CONFIGURACAO ──────────────────────────────────────────────────────
$branch   = 'main'
$repoDir  = $PSScriptRoot                              # o script mora na raiz do repo
$siteUrl  = 'https://financeiro.gamo.net.br/login'
$esperaS  = 15                                         # intervalo entre checagens do site
$tentativas = 40                                       # 40 x 15s = 10 min
# ──────────────────────────────────────────────────────────────────────

# Impressao digital do que esta no ar, para provar que o deploy pegou.
function Get-Impressao {
    param($url)
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 25
    } catch {
        return $null
    }
    $tag = $null
    foreach ($k in $r.Headers.Keys) {
        if ($k -ieq 'ETag') { $tag = $r.Headers[$k]; break }
    }
    if ($tag) { return "etag:$tag" }

    # Sem ETag, cai para o hash do HTML.
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($r.Content)
    $hash  = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
    return 'sha:' + [BitConverter]::ToString($hash).Replace('-', '').Substring(0, 16)
}

function Invoke-Deploy {
    # 1. Sanidade do repositorio
    Write-Host '-> Verificando repositorio local...' -ForegroundColor Cyan

    if (-not (Test-Path (Join-Path $repoDir '.git'))) {
        throw "$repoDir nao e um repositorio git."
    }
    Set-Location $repoDir

    $atual = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($atual -ne $branch) {
        throw "voce esta na branch '$atual', nao em '$branch'."
    }

    # Nao commita sozinho: um commit automatico manda ao ar o que voce nao revisou.
    $status = git status --porcelain
    if ($status) {
        Write-Host 'Ha mudancas nao commitadas:' -ForegroundColor Yellow
        $status | ForEach-Object { Write-Host "   $_" }
        throw 'commite ou descarte as mudancas antes do deploy.'
    }

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        throw 'gh CLI nao encontrado. Sem ele nao da para acompanhar o build.'
    }

    # 2. Marca o que esta no ar agora
    $antes = Get-Impressao $siteUrl
    if ($antes) {
        Write-Host "   no ar agora: $antes" -ForegroundColor DarkGray
    } else {
        Write-Host '   AVISO: o site nao respondeu; nao vai dar para confirmar a troca.' -ForegroundColor Yellow
    }

    # 3. Push
    Write-Host '-> Enviando para o GitHub...' -ForegroundColor Cyan
    git push origin $branch
    if ($LASTEXITCODE -ne 0) { throw 'git push falhou.' }

    $sha = (git rev-parse HEAD).Trim()
    Write-Host "   commit $($sha.Substring(0,7))" -ForegroundColor DarkGray

    # 4. Acompanha o Actions (que builda, publica e chama o Coolify)
    Write-Host '-> Localizando o run do GitHub Actions...' -ForegroundColor Cyan
    $runId = $null
    for ($i = 0; $i -lt 24; $i++) {
        $json = gh run list --branch $branch --limit 10 --json databaseId,headSha
        if ($json) {
            $run = ($json | ConvertFrom-Json) | Where-Object { $_.headSha -eq $sha } | Select-Object -First 1
            if ($run) { $runId = $run.databaseId; break }
        }
        Start-Sleep -Seconds 5
    }
    if (-not $runId) { throw "nenhum run do Actions encontrado para o commit $sha." }

    Write-Host "-> Aguardando build + gatilho do Coolify (run $runId)..." -ForegroundColor Cyan
    gh run watch $runId --exit-status --interval 15
    if ($LASTEXITCODE -ne 0) {
        throw "o workflow falhou. Veja: gh run view $runId --log-failed"
    }

    # 5. Espera o Coolify trocar o container
    if (-not $antes) {
        Write-Host '-> Workflow OK. Sem impressao inicial, confirme o site na mao.' -ForegroundColor Yellow
        return
    }

    Write-Host '-> Aguardando o Coolify publicar...' -ForegroundColor Cyan
    for ($i = 1; $i -le $tentativas; $i++) {
        # Checa antes de dormir: o Coolify costuma trocar o container em segundos.
        $agora = Get-Impressao $siteUrl
        if ($agora -and $agora -ne $antes) {
            Write-Host "   agora no ar: $agora" -ForegroundColor DarkGray
            Write-Host '-> Deploy confirmado no site.' -ForegroundColor Green
            return
        }
        if ($i % 4 -eq 0) {
            Write-Host "   ainda o mesmo conteudo ($($i * $esperaS)s)..." -ForegroundColor DarkGray
        }
        Start-Sleep -Seconds $esperaS
    }

    throw 'o workflow passou, mas o site nao mudou. Confira o painel do Coolify.'
}

# O corpo roda dentro de try/finally so para devolver o diretorio de
# trabalho de onde voce chamou o script.
$origem = Get-Location
$codigo = 0
try {
    Invoke-Deploy
} catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    $codigo = 1
} finally {
    Set-Location $origem
}
exit $codigo
