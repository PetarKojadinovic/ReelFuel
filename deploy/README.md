# ReelFuel na Hetzner serveru — korak po korak

Cilj: backend radi 24/7 na serveru (Hetzner CX23), telefon mu pristupa preko HTTPS-a, laptop više ne mora da bude upaljen.
Whisper i MediaPipe rade na serveru isto kao na laptopu (ništa nije promenjeno, samo je `torch` bez CUDA jer server nema grafičku).

```
Telefon (APK) ──HTTPS──► Caddy (443, sertifikat) ──► uvicorn 127.0.0.1:8000 ──► SQLite
                          na serveru                  (spolja nedostupan)
```

Sve komande su za **PowerShell na laptopu**, iz korena repoa (`C:\Users\DELL\Desktop\ReelFuel`), osim ako piše drugačije.

---

## Zašto treba domen (iako je mobilna aplikacija)

Domen nije za web stranicu, nego za **HTTPS**.
- Bez HTTPS-a, ključ (`X-API-Key`), težina, kalorije i sve ostalo idu internetom kao čist tekst. Svako na putu (javni Wi-Fi, mreža operatera) može da ih pročita i da ukrade ključ.
- Android u pravom (ne-dev) APK-u podrazumevano **blokira** obične `http://` veze ka internetu.
- Besplatan HTTPS sertifikat (Let's Encrypt) se izdaje za **ime**, ne za IP adresu.

Zato: **besplatan poddomen sa DuckDNS** (npr. `reelfuel-petar.duckdns.org`). Ne plaća se ništa. Caddy na serveru sam pribavi sertifikat i obnavlja ga.

---

## Korak 0 — Commit
Skripta šalje **poslednji commit**, ne izmene koje nisu commit-ovane.
```powershell
git status
git grep --cached -n -E "sk-ant-[A-Za-z0-9_-]{20,}"     # mora biti prazno
git add -A
git commit -m "Server: deploy skripte, granica zahteva, DOCS/CORS iz .env"
```

## Korak 1 — SSH ključ (jednom)
SSH ključ je "ključ od servera" umesto lozinke. Windows 10 ga ima ugrađenog.
```powershell
ssh-keygen -t ed25519 -C "reelfuel-laptop"
```
Enter za podrazumevano mesto; lozinku za ključ možeš da ostaviš praznu (ili je upiši — tada je traži pri svakom povezivanju).
Kopiraj **javni** deo u clipboard:
```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | Set-Clipboard
```
Fajl `id_ed25519` (bez `.pub`) je tajan — nikome ga ne šalji i ne stavljaj u git.

## Korak 2 — Hetzner server
1. Napravi nalog na **hetzner.com** → Cloud. (Traže potvrdu identiteta / kartice — to je normalno.)
2. **Cloud Console** → New project "ReelFuel" → **Add Server**:
   - **Location**: Nuremberg ili Falkenstein (Nemačka, najbliže Sloveniji)
   - **Image**: Ubuntu **24.04**
   - **Type**: Shared vCPU → x86 → **CX23** (2 vCPU, 4 GB RAM, 40 GB)
   - **Networking**: uključi **Public IPv4** i IPv6
   - **SSH keys**: Add SSH key → nalepi iz clipboard-a (korak 1)
   - **Backups**: preporuka uključi (+20% cene, ~1 €/mes) — Hetzner pravi kopiju celog servera svaki dan
   - Firewalls / Volumes: ništa (firewall podešava skripta)
   - **Name**: `reelfuel`
3. Create & Buy. Za ~1 min dobiješ **IPv4 adresu** (npr. `91.98.12.34`). Zapiši je — u komandama ispod je to `<IP>`.
4. Provera (prvi put pita "Are you sure...?" → kucaj `yes`):
   ```powershell
   ssh root@<IP> "hostname"
   ```
   Treba da ispiše `reelfuel` bez pitanja za lozinku.

## Korak 3 — DuckDNS (besplatan domen)
1. **duckdns.org** → prijava preko GitHub-a ili Google-a.
2. U polje "sub domain" upiši npr. `reelfuel-petar` → **add domain**.
3. U "current ip" upiši `<IP>` servera → **update ip**.
4. Provera (za minut-dva):
   ```powershell
   nslookup reelfuel-petar.duckdns.org
   ```
   Mora da pokaže `<IP>` servera. U daljem tekstu: `<DOMEN>` = `reelfuel-petar.duckdns.org`.

## Korak 4 — Priprema servera (jednom, ~5 min)
```powershell
.\deploy\posalji.ps1 -Server <IP> -Postavi -Domen <DOMEN>
```
Šta radi (`deploy/postavi_server.sh`): ažurira Ubuntu, vremenska zona Ljubljana, instalira Python 3.13, FFmpeg i Caddy (HTTPS), pravi korisnika `reelfuel` (backend ne radi kao root), firewall (samo SSH 22 i HTTPS 80/443), swap 4 GB, automatske bezbednosne nadogradnje, isključuje prijavu lozinkom.

## Korak 5 — Prvo slanje: kod + tvoji podaci (jednom, ~10 min)
**Ugasi backend na laptopu** (zatvori prozor "ReelFuel backend"), pa:
```powershell
.\deploy\posalji.ps1 -Server <IP> -PrviPut
```
Šalje preko SSH-a (šifrovano): `backend/reelfuel.db` (tvoji podaci), `backend/.env` (ključevi), katalog vežbi i MediaPipe model, pa kod iz poslednjeg commit-a. Na serveru instalira pakete (prvi put 5–10 min) i pokrene servis.
- Skripta **odbija** da prepiše bazu ako na serveru već postoji.
- U `.env` na serveru sama doda `DOCS=0` (nema `/docs`) i `CORS_ORIGINS=` (bez CORS-a).
- Na kraju mora da piše `OK: backend radi.`

**Od ovog trenutka baza na serveru je prava.** Baza na laptopu je stara kopija — ne unosi više podatke preko laptop servera, razići će se.

## Korak 6 — Provera
```powershell
curl.exe -s https://<DOMEN>/
```
Treba: `{"detail":"Nevazeci ili nedostajuci API kljuc"}` — znači HTTPS radi i server traži ključ. Prvi zahtev može da traje ~10 s (Caddy pribavlja sertifikat).

## Korak 7 — Telefon
**Brza provera sa postojećim dev buildom**: Ja → Veza sa laptopom → **Ručno** → `https://<DOMEN>` → Testiraj vezu.
Dev build i dalje učitava ekrane sa laptopa (Metro), pa laptop i dalje mora da radi. Za život bez laptopa → korak 8.

## Korak 8 — APK koji ne treba laptop (preview build)
Dev build uzima JavaScript sa laptopa. **Preview** build ima sve upakovano u APK i odmah zna adresu servera.
`.env` se ne šalje na EAS (u `.gitignore` je), pa se adresa i ključ upisuju u EAS jednom:
```powershell
cd mobile
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://<DOMEN> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_API_KEY --value <ISTI_KLJUC_KAO_APP_SECRET_KEY> --visibility sensitive
eas build --profile preview --platform android
```
(`<ISTI_KLJUC...>` prepiši iz `backend\.env` — ne šalji ga nikome i ne stavljaj u git.)
Instaliraj APK sa linka koji EAS da. Ako Android kaže da se ne može instalirati preko postojeće aplikacije, prvo deinstaliraj dev build (podaci su na serveru, gube se samo lokalna podešavanja: vremena obroka, podsetnici).
Za dalji razvoj i dalje možeš da koristiš dev build + laptop.

## Korak 9 — Limit potrošnje (obavezno)
Ključ je u APK-u — ko ga izvuče može da troši tvoj Anthropic kredit. Server ima granicu (150 AI zahteva/sat, 30 linkova/sat), ali prava zaštita je:
**console.anthropic.com → Settings → Limits → mesečni limit potrošnje** (npr. 10 $).

---

## Svakodnevno

**Nova verzija backenda** (posle commit-a):
```powershell
.\deploy\posalji.ps1 -Server <IP>
```
Baza, `.env`, katalog i kopije se ne diraju.

**Poruke servera (greške):**
```powershell
ssh root@<IP> "journalctl -u reelfuel -n 100 --no-pager"
```

**Restart:**
```powershell
ssh root@<IP> "systemctl restart reelfuel"
```

**Kopije baze**: server pravi kopiju svaki dan u 03:30 (`reelfuel-kopija.timer`, čuva se 10) u `/opt/reelfuel/backend/backups/`. Skidanje na laptop:
```powershell
mkdir -Force server-kopije
scp "root@<IP>:/opt/reelfuel/backend/backups/*.db" .\server-kopije\
```
(`server-kopije/` ne stavljaj u git — u njoj su zdravstveni podaci.)

**Vraćanje kopije** na serveru:
```powershell
ssh root@<IP> "systemctl stop reelfuel && cd /opt/reelfuel/backend && cp reelfuel.db reelfuel-pre-vracanja.db && cp backups/<IME>.db reelfuel.db && chown reelfuel:reelfuel reelfuel.db && systemctl start reelfuel"
```

## Poznati rizici
- **Instagram sa servera**: Instagram često blokira adrese data centara (traži prijavu), pa skidanje reela sa servera može da ne uspe iako sa laptopa radi. TikTok obično radi. Ako se desi, rešava se kolačićima prijave za yt-dlp — javi.
- **Brzina**: Whisper `small` na 2 vCPU je sporiji nego na laptopu (reel od 1 min ≈ 1–2 min obrade). Obrada je u pozadini, pa ne smeta.
- Ključ u APK-u i dalje nije prava autentikacija (nalozi/JWT — kasnije).
