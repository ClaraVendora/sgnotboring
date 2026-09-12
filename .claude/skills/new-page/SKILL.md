---
name: new-page
description: Scaffold a new route-level page in apps/web (pages/<Name>.jsx) and register it in App.jsx following project conventions. Usage - /new-page <Name> <route>
---

Create a page: `$ARGUMENTS` (PascalCase name, then route path e.g. `Categories /categories` or `PlaceDetail /places/:id`).

## Rules (from CLAUDE.md)

- Pages live in `apps/web/src/pages/<Name>.jsx`, one file per route, default export.
- A page **owns** data fetching and URL state; it composes components from `components/`. Components never fetch.
- All API calls go through `apps/web/src/lib/api.js`; add a function there if the endpoint isn't covered.
- Chakra UI v3 only. Layout with `Container maxW="6xl" py={10}` + `Stack`, matching `Home.jsx`.

## Steps

1. Read `apps/web/src/pages/Home.jsx` and `App.jsx` first; copy their patterns, don't invent new ones.
2. Create `pages/<Name>.jsx` with:
   - route params via `useParams()` / filters via `useSearchParams()` (filters live in the URL so views are shareable);
   - the fetch pattern from `Home.jsx`: `useEffect` with a cancelled flag, `loading` derived from a key, `error` state, `<Spinner />` while loading, `fg.error` text on error, an empty state;
   - a `← Back` `Link asChild` + `RouterLink` if the page is reachable from another page.
3. Register in `App.jsx`: add `<Route path="<route>" element={<Name />} />` **above** the `*` route.
4. Link to it from wherever users get there (a card, a nav item). Use `LinkOverlay`/`Link` with `asChild` + `RouterLink`, never `<a href>`.
5. If a chunk of JSX is reused by another page, extract it with `/new-component` instead of copying.
6. Verify: `npm run lint && npm run build`, then load the route in the browser (dev servers via `npm run dev`), including a hard reload on the deep link.
7. Add the route to the README routing table (§7).
