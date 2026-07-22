# Release Checklist

Use this checklist before publishing a GitHub release or LinkedIn demo.

## Repository Hygiene

- Build outputs are ignored: `dist/`, `dist-frontend/`.
- Local OS files are ignored: `.DS_Store`.
- Local environment files are ignored: `.env`, `.env.*`.
- Browser or Node database files are ignored unless intentionally added as fixtures.
- `.env.example` contains only safe placeholder guidance.

## Verification

Run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run frontend:typecheck
npm run frontend:build
```

## Demo Sequence

1. Start the frontend with `npm run frontend`.
2. Load the example database.
3. Execute Basic select.
4. Execute Filter.
5. Execute Aggregate.
6. Execute Join.
7. Execute Constraint error.
8. Execute Rollback.
9. Inspect Engine and History traces.
10. Save the browser-backed database.

## Release Notes

- The frontend runs in the browser and uses browser-backed persistence for the showcase.
- Engine metrics shown in the workbench come from real execution traces.
- Unsupported SQL should be presented as a current limitation, not as a hidden feature.
