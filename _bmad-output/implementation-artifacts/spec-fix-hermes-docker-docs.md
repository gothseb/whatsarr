---
title: 'Inclure le guide Hermes dans le build Docker'
type: 'bugfix'
created: '2026-10-12'
status: 'done'
route: 'one-shot'
---

# Inclure le guide Hermes dans le build Docker

## Intent

**Problem:** Le build Vite de l’image Docker ne résout pas `docs/hermes-agent.md?raw`, car `.dockerignore` exclut le dossier docs.

**Approach:** Exclure les enfants de docs et réinclure explicitement le guide Markdown importé par l’interface. Les autres documents restent exclus.

## Suggested Review Order

1. [Contexte Docker](../../.dockerignore) — inclusion du seul guide nécessaire au build.
2. [Import du guide](../../apps/web/src/HermesPage.tsx) — documentation embarquée dans le bundle web.

Validation : build Vite isolé réussi avec uniquement le guide dans docs ; revue indépendante sans régression identifiée. Docker complet non exécuté : moteur Docker local indisponible.
