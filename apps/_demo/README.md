# _demo

Minimal Expo app that proves the platform patterns end to end. Platform CI typechecks it, runs `expo-doctor`, and (on a native runner) prebuilds it. Do not replace this with a real app; clone the repo and build your app at `apps/app/`.

It ships one screen, the check-and-report entry point, calling `lib/api.ts` with a local heuristic fallback so it runs without a live API. Keep it small.

## Run

```bash
npm install
npm run start      # Expo dev server
npm run typecheck
npm run lint
```
