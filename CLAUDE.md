# Working on miDepo

## Git

- Push every finished change to `main`, unless the owner says not to for that change. Fast-forward only: if `main` has moved on, merge it into the working branch first, then push.
- Before pushing, run `npm run typecheck`, `npm test` and a production build (`npx next build`); push only when they pass.

## Conventions

- Code, comments, database names and configuration are in English. Interface copy is Spanish (Argentina, voseo).
- Kept Spanish on purpose: page URLs and their query parameters, the CSV headers and condition words in files sent to Fierro, and zone codes printed on shelf labels.
- Product facts are in `PRODUCT.md`; the design system is in `DESIGN.md`.
