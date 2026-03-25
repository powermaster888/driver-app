# driver-app

Cross-platform delivery driver app for Healthy Living.

## Current state

This folder currently holds the product/design plan for v1.

Chosen direction:
- **Mobile:** Expo + React Native + Tamagui
- **Backend:** FastAPI
- **System of record:** Odoo
- **Architecture:** thin mobile client + Odoo-backed API layer

## Docs

- `docs/driver-app-plan.md` — consolidated product + technical plan
- `planning/next-steps.md` — recommended planning sequence before implementation

## Product summary

The app is for delivery drivers and should work on **iOS + Android**.

v1 goals:
- replace paper / WhatsApp delivery completion workflow
- provide reliable proof-of-delivery records
- provide reliable cash collection records
- support weak/no-signal doorstep situations with offline capture + later sync
