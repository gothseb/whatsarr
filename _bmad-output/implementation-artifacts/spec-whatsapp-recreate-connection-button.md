---
title: 'Afficher un bouton de recreation WhatsApp'
type: 'feature'
created: '2026-05-20'
status: 'done'
route: 'one-shot'
---

# Afficher un bouton de recreation WhatsApp

## Intent

**Problem:** Quand WhatsApp est deconnecte mais qu'une session locale existe, l'action `Connecter` n'indique pas clairement qu'il faut recreer la connexion en remplaçant la session locale.

**Approach:** Afficher un bouton explicite `Recreer la connexion` dans cet etat, et le brancher directement sur le remplacement de session deja supporte par l'API.

## Suggested Review Order

- [apps/web/src/App.tsx](../../../apps/web/src/App.tsx) -- logique d'affichage et action directe de recreation de session WhatsApp.

## Verification

**Commands:**
- `pnpm --filter @whatsarr/web lint` -- expected: TypeScript web OK.
- `pnpm --filter @whatsarr/web build` -- expected: build Vite OK.
