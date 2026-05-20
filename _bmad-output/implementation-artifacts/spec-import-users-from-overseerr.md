---
title: 'Importer les utilisateurs depuis Overseerr'
type: 'feature'
created: '2026-05-20'
status: 'done'
route: 'one-shot'
---

# Importer les utilisateurs depuis Overseerr

## Intent

**Problem:** L'import actuel des utilisateurs depend de l'endpoint Plex `/accounts`, qui peut echouer selon le token ou la configuration du serveur. Sans utilisateurs importes, le mapping WhatsApp ne peut pas rendre les notifications individuelles exploitables.

**Approach:** Ajouter Overseerr comme source prioritaire d'import utilisateurs, car l'application y connait deja les demandeurs. Garder Plex comme fallback et conserver les mappings existants sur refresh.

## Suggested Review Order

- [apps/api/src/modules/overseerr/overseerr.service.ts](../../../apps/api/src/modules/overseerr/overseerr.service.ts) -- nouveau client d'import Overseerr, pagination, normalisation d'identifiants.
- [apps/api/src/modules/mapping/mapping.service.ts](../../../apps/api/src/modules/mapping/mapping.service.ts) -- choix de source Overseerr puis Plex, resolution des aliases `overseerr:<id>`, `<id>` et `username`.
- [apps/api/src/modules/mapping/mapping.service.spec.ts](../../../apps/api/src/modules/mapping/mapping.service.spec.ts) -- couverture priorite Overseerr, fallback Plex, resolution d'alias.
- [apps/api/src/modules/overseerr/overseerr.service.spec.ts](../../../apps/api/src/modules/overseerr/overseerr.service.spec.ts) -- contrat HTTP `/api/v1/user` et header `X-Api-Key`.
- [apps/web/src/MappingPage.tsx](../../../apps/web/src/MappingPage.tsx) -- libelle UI plus neutre pour l'import.

## Verification

**Commands:**
- `pnpm --filter @whatsarr/api test -- mapping.service.spec.ts` -- expected: tests ciblés mapping OK.
- `pnpm --filter @whatsarr/api test -- overseerr.service.spec.ts` -- expected: tests ciblés Overseerr OK.
- `pnpm --filter @whatsarr/api lint` -- expected: TypeScript API OK.
- `pnpm --filter @whatsarr/api test` -- expected: suite API OK.
- `pnpm build` -- expected: build API/shared/web OK.
