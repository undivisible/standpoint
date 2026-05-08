# todo

## easy completions from the old README list

- live: completed as Spectrum live rooms in `0.8.25-beta`
- multiplayer: completed for Spectrum rooms in `0.8.25-beta`
- half redesign: completed enough to remove from the active TODO list; remaining visual work should be tracked as specific UI bugs
- deployment cleanup: completed in docs; Standpoint now documents Cloudflare Workers instead of Netlify

## active

- saving tierlist as images: build a client-side export for the visible tier board first, then optionally add a server render path later for share previews
- items can belong to groups which show in statistics and can be filtered
- algorithmic feed and comments
- replace or harden the image API path: move search behind a SvelteKit server route, proxy/cache selected images into R2, and avoid exposing browser-side search keys
- multiplayer tierlists with shared live editing, presence, cursors/selection, conflict handling, autosave, permissions, history, and undo
- repair image logic after the new implementation transfer
- image cropping after placing and more tools
- item colors
- update accents to be part of poll presets
- localisation in various languages

## future

- mobile app
- sharing links create a toast that allows you to follow people
- quizzes like 8values

## implementation notes

- image search should not call third-party search APIs directly from the browser. the cleanest version is `/api/images/search?q=...`, backed by one provider at a time, returning normalized `{ url, thumbnail, title, source }` results.
- selected external images should be imported through the upload pipeline and saved into R2 before being attached to a tierlist item. that avoids broken hotlinks, CORS export failures, and provider rate-limit weirdness.
- tierlist image export should start with a DOM-to-canvas client export of the tier board area only. use the current rendered layout, wait for fonts/images, require images to be same-origin/R2 URLs, then download PNG.
- if public share images matter later, add a Worker-side renderer that loads the tierlist data and renders a deterministic image for Open Graph cards.
