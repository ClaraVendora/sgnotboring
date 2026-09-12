---
name: new-component
description: Create a reusable, presentational Chakra UI v3 component in apps/web/src/components following project conventions. Usage - /new-component <Name> [what it renders]
---

Create a component: `$ARGUMENTS` (PascalCase name, optional one-line purpose).

## Rules (from CLAUDE.md)

- `apps/web/src/components/<Name>.jsx`, default export, **props in → JSX out**.
- No `fetch`, no `lib/api.js` import, no `useParams`/`useSearchParams`. Data and callbacks arrive as props.
- Chakra UI v3 syntax (`Card.Root`, `colorPalette`, `gap`, `asChild`). Pure helpers go in `lib/*.js`, not inside the component.
- Grow into `components/<Name>/index.jsx` + sibling files only when it needs private subcomponents.

## Steps

1. **Check for duplication first.** Grep `apps/web/src` for similar JSX (same Chakra parts, same props). If it exists inside a page, *move* it into the new component and replace the original with the component — don't leave two copies.
2. Read `components/PlaceCard.jsx` and `components/TagFilter.jsx` for the house style (small, named props, callbacks named `onX`).
3. Create the file. Keep props explicit and few; destructure them in the signature. Render nothing (return `null`) for empty inputs rather than throwing.
4. Use it from a page. A component with zero callers doesn't get merged.
5. Verify: `npm run lint && npm run build`, then view it in the browser.
