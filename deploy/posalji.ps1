# ReelFuel - slanje backenda na Hetzner server (pokreci iz korena repoa, PowerShell).
#
#   .\deploy\posalji.ps1 -Server 1.2.3.4 -Postavi -Domen ime.duckdns.org   # 1) jednom: pripremi server
#   .\deploy\posalji.ps1 -Server 1.2.3.4 -PrviPut                          # 2) jednom: kod + baza + .env + katalog + model
#   .\deploy\posalji.ps1 -Server 1.2.3.4                                   # 3) svaka nova verzija (samo kod)
#
# Salje se POSLEDNJI COMMIT (git archive), ne necommit-ovane izmene.
# Fajl je namerno cist ASCII (PowerShell 5.1 kvari UTF-8 bez BOM-a).
param(
    [Parameter(Mandatory = $true)][string]$Server,
    [switch]$Postavi,
    [string]$Domen,
    [switch]$PrviPut
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$cilj = "root@$Server"

function Proveri($poruka) {
    if ($LASTEXITCODE -ne 0) { throw $poruka }
}

if ($Postavi) {
    if (-not $Domen) { throw "Uz -Postavi treba i -Domen (npr. -Domen reelfuel-petar.duckdns.org)" }
    scp "deploy\postavi_server.sh" "${cilj}:/root/postavi_server.sh"; Proveri "Slanje skripte nije uspelo"
    # sed skida Windows kraj reda (\r) ako ga je git dodao
    ssh $cilj "sed -i 's/\r$//' /root/postavi_server.sh && bash /root/postavi_server.sh $Domen"; Proveri "Podesavanje servera nije uspelo"
    Write-Host ""
    Write-Host "Server spreman. Sada: .\deploy\posalji.ps1 -Server $Server -PrviPut" -ForegroundColor Green
    exit 0
}

$izmene = git status --porcelain -- backend deploy
if ($izmene) {
    Write-Host "Upozorenje: necommit-ovane izmene u backend/ ili deploy/ se NE salju (salje se poslednji commit)." -ForegroundColor Yellow
}

if ($PrviPut) {
    if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) {
        throw "Backend na laptopu radi (port 8000). Ugasi ga pre kopiranja baze, da kopija bude cela."
    }
    foreach ($f in @("backend\.env", "backend\reelfuel.db", "backend\data\vezbe_katalog.json", "backend\models\pose_landmarker.task")) {
        if (-not (Test-Path $f)) { throw "Nema fajla $f" }
    }
    # Nikad ne prepisuj bazu koja vec postoji na serveru
    ssh $cilj "test ! -e /opt/reelfuel/backend/reelfuel.db"
    if ($LASTEXITCODE -ne 0) { throw "Na serveru VEC postoji baza - ne prepisujem je. Pokreni bez -PrviPut." }

    Write-Host "== Saljem bazu, .env, katalog vezbi i model (preko SSH, sifrovano)"
    scp "backend\reelfuel.db" "${cilj}:/opt/reelfuel/backend/reelfuel.db"; Proveri "Slanje baze nije uspelo"
    scp "backend\.env" "${cilj}:/opt/reelfuel/backend/.env"; Proveri "Slanje .env nije uspelo"
    scp "backend\data\vezbe_katalog.json" "${cilj}:/opt/reelfuel/backend/data/vezbe_katalog.json"; Proveri "Slanje kataloga nije uspelo"
    scp "backend\models\pose_landmarker.task" "${cilj}:/opt/reelfuel/backend/models/pose_landmarker.task"; Proveri "Slanje modela nije uspelo"
}

Write-Host "== Pakujem poslednji commit"
$arhiva = Join-Path $env:TEMP "reelfuel.tar.gz"
git archive --format=tar.gz -o $arhiva HEAD backend deploy; Proveri "git archive nije uspeo"
scp $arhiva "${cilj}:/tmp/reelfuel.tar.gz"; Proveri "Slanje koda nije uspelo"
Remove-Item $arhiva

Write-Host "== Instaliram na serveru"
ssh $cilj "tar -xzf /tmp/reelfuel.tar.gz -C /opt/reelfuel deploy/instaliraj.sh && sed -i 's/\r$//' /opt/reelfuel/deploy/instaliraj.sh && bash /opt/reelfuel/deploy/instaliraj.sh"
Proveri "Instalacija nije uspela (poruke su iznad)"

Write-Host ""
Write-Host "Gotovo. Backend radi na serveru." -ForegroundColor Green
