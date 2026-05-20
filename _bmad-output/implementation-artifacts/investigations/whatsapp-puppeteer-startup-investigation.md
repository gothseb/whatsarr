# Investigation: demarrage WhatsApp Puppeteer

## Hand-off Brief

1. **What happened.** Confirmed: la connexion WhatsApp echouait parce que Puppeteer ne trouvait pas Chrome `146.0.7680.31` dans `C:\Users\seb\.cache\puppeteer`, avant generation du QR code.
2. **Where the case stands.** Concluded: l'adaptateur utilisait seulement `PUPPETEER_EXECUTABLE_PATH`/`CHROMIUM_PATH` puis le cache Puppeteer; en dev Windows aucune variable n'etait definie alors que Chrome systeme etait installe.
3. **What's needed next.** Redemarrer ou laisser le watch API prendre la compilation, puis cliquer `Connecter`; si l'app demande de remplacer la session locale, confirmer pour supprimer la session partielle creee par l'echec precedent.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-05-20 |
| Status | Concluded |
| System | Windows dev workspace, API NestJS, whatsapp-web.js/Puppeteer |
| Evidence sources | Screenshot utilisateur, `api-runtime.log`, source API/Web, filesystem local |

## Problem Statement

L'utilisateur ne peut pas connecter WhatsApp a l'app. L'UI affiche `WhatsApp n'a pas pu demarrer. Verifiez Chromium/Puppeteer.` et `Session locale detectee dans /data`.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| `api-runtime.log` | Available | Contient l'erreur Puppeteer exacte: Chrome `146.0.7680.31` introuvable dans `C:\Users\seb\.cache\puppeteer`. |
| `apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.ts` | Available | L'adaptateur passait seulement les variables d'environnement comme `executablePath`. |
| `apps/web/src/App.tsx` | Available | Le texte `/data` etait code en dur dans l'UI. |
| Filesystem local | Available | Chrome est installe dans `C:\Program Files\Google\Chrome\Application\chrome.exe`; une session partielle existe dans `apps/api/data/whatsapp/session-whatsarr`. |

## Confirmed Findings

### Finding 1: Puppeteer ne trouvait pas sa version Chrome attendue

**Evidence:** `api-runtime.log` autour de l'evenement `20/05/2026 15:40:15`.

**Detail:** L'erreur indique que Chrome `146.0.7680.31` manque dans le cache Puppeteer, donc le client WhatsApp ne peut pas demarrer.

### Finding 2: L'app locale avait pourtant Chrome systeme disponible

**Evidence:** verification filesystem de `C:\Program Files\Google\Chrome\Application\chrome.exe`.

**Detail:** Le probleme n'etait pas l'absence totale de navigateur, mais l'absence de resolution automatique vers Chrome systeme en mode dev.

### Finding 3: Le texte `/data` etait trompeur en dev

**Evidence:** `apps/web/src/App.tsx`.

**Detail:** En dev local, `DATA_DIR` tombe sur `apps/api/data`; `/data` est le chemin Docker.

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | `apps/api/src/modules/whatsapp/adapters/whatsapp-web-js.adapter.ts`, `client.initialize()` |
| Trigger | Clic `Connecter` ou restauration automatique si une session locale existe |
| Condition | Pas de `PUPPETEER_EXECUTABLE_PATH`/`CHROMIUM_PATH`, cache Puppeteer sans Chrome `146.0.7680.31` |
| Related files | `apps/web/src/App.tsx`, `Dockerfile`, `docker-compose.yml` |

## Conclusion

**Confidence:** High

La cause racine est la resolution du navigateur Puppeteer en environnement local Windows. Docker etait configure avec Chromium, mais le mode dev local ne l'etait pas; Puppeteer cherchait donc une version de Chrome absente de son cache.

## Recommended Next Steps

### Fix direction

Applique: l'adaptateur utilise maintenant `PUPPETEER_EXECUTABLE_PATH`/`CHROMIUM_PATH` si defini, sinon cherche Chrome/Edge systeme sous Windows. L'UI n'affiche plus `/data` en dur.

### Diagnostic

Si un autre echec apparait, consulter `api-runtime.log` apres le prochain clic `Connecter`; ce sera une erreur post-demarrage navigateur, differente de `Could not find Chrome`.

## Reproduction Plan

1. Lancer l'API en dev sans `PUPPETEER_EXECUTABLE_PATH`.
2. Ouvrir WhatsApp et cliquer `Connecter`.
3. Avant correction: erreur `Could not find Chrome`.
4. Apres correction: Chrome systeme demarre; l'app doit passer a `QR code pret` ou a l'etape suivante de restauration.
