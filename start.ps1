# ReelFuel - pokrece backend i Expo u dva prozora i ispise adresu za telefon.
# Pokretanje: dupli klik na start.bat (ili u PowerShell-u: .\start.ps1)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# 1) IP adresa mreze na kojoj je laptop (Wi-Fi ili hotspot) - interfejs sa podrazumevanom rutom
$route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
    Sort-Object { $_.RouteMetric + $_.InterfaceMetric } | Select-Object -First 1
$ip = $null
if ($route) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue |
        Select-Object -First 1).IPAddress
}
if (-not $ip) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notmatch '^(127|169\.254)' -and $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware'
    } | Select-Object -First 1).IPAddress
}
if (-not $ip) {
    Write-Host "Nisam nasao mreznu adresu. Da li si povezan na Wi-Fi ili hotspot?" -ForegroundColor Red
    Read-Host "Pritisni Enter za izlaz"
    exit 1
}

# 2) Ugasi stare instance na portovima 8000/8081 (ako su ostale od ranije)
foreach ($port in 8000, 8081) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# 3) Provere
if (-not (Test-Path "$root\backend\venv\Scripts\python.exe")) {
    Write-Host "Nema backend\venv. Napravi ga: cd backend; python -m venv venv; .\venv\Scripts\pip install -r requirements.txt" -ForegroundColor Red
    Read-Host "Pritisni Enter za izlaz"
    exit 1
}
if (-not (Test-Path "$root\backend\.env")) {
    Write-Host "Nema backend\.env (kopiraj backend\.env.example i popuni kljuceve)." -ForegroundColor Red
    Read-Host "Pritisni Enter za izlaz"
    exit 1
}

# 4) Backend u novom prozoru
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle = 'ReelFuel backend'; Set-Location '$root\backend'; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
)

# 5) Expo u novom prozoru, vezan za pravu adresu (inace moze da uzme WSL/VirtualBox adresu)
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "`$Host.UI.RawUI.WindowTitle = 'ReelFuel Expo'; `$env:REACT_NATIVE_PACKAGER_HOSTNAME = '$ip'; Set-Location '$root\mobile'; npx expo start"
)

# 6) Sacekaj da se backend digne
Write-Host "Pokrecem servere..." -ForegroundColor Cyan
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
    try { Invoke-WebRequest "http://localhost:8000/docs" -UseBasicParsing -TimeoutSec 2 | Out-Null; $ok = $true; break } catch { Start-Sleep 1 }
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " ReelFuel je pokrenut" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host " Na telefonu otvori ReelFuel i, ako trazi adresu, unesi:"
Write-Host "    http://${ip}:8081" -ForegroundColor Yellow
Write-Host " Backend (automatski ga nalazi aplikacija):  http://${ip}:8000"
if (-not $ok) { Write-Host " ! Backend se jos nije odazvao - pogledaj prozor 'ReelFuel backend'." -ForegroundColor Red }
Write-Host ""
Write-Host " Telefon i laptop moraju biti na istoj mrezi."
Write-Host " Ako telefon ne moze da se poveze, jednom pokreni u PowerShell-u kao administrator:"
Write-Host "    New-NetFirewallRule -DisplayName 'ReelFuel dev' -Direction Inbound -Protocol TCP -LocalPort 8000,8081 -Action Allow -Profile Any" -ForegroundColor DarkGray
Write-Host " Za gasenje: zatvori prozore 'ReelFuel backend' i 'ReelFuel Expo'."
Write-Host ""
Read-Host "Pritisni Enter da zatvoris ovaj prozor (serveri nastavljaju da rade)"
