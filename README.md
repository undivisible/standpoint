# this is standpoint

my year 11 vce unit 3 applied computing software development that i still maintain for some reason.

current version: `0.8.25-beta`

standpoint is an opinion platform for polls, tierlists, drafts, profiles, and live spectrum rooms. the old separate backend is gone: the app now runs as a SvelteKit app on Cloudflare, with server routes handling the API surface directly.

## stack

- Svelte 5 and SvelteKit
- TypeScript
- Bun for scripts, installs, tests, and local dev
- Tailwind CSS
- Cloudflare Workers via `@sveltejs/adapter-cloudflare`
- Cloudflare D1 for relational app data
- Cloudflare R2 for uploads
- Cloudflare Durable Objects for live spectrum rooms and websocket state
- Firebase Auth compatibility and fallback paths where the app still needs them

## development

```sh
bun run dev
```

## quality gates

```sh
bun run format
bun run lint
bun run check
bun run test
bun run build
```

## deployment

standpoint is deployed with Cloudflare Workers through Wrangler. it is not deployed on Netlify anymore.

the active deployment config is `wrangler.toml`, which binds:

- `DB` to Cloudflare D1
- `UPLOADS` to Cloudflare R2
- `ROOMS` to the room Durable Object
- static assets from `.svelte-kit/cloudflare`

## architecture note

Elysia + Bun would be good for a standalone Bun API server, but it is not the best fit for the current deployment shape. this repo already uses SvelteKit server routes on Cloudflare Workers, so adding Elysia would introduce a second routing layer without replacing the Worker, D1, R2, and Durable Object integration that is already here.

keeping Bun as the package manager/tool runner is still the right call.

## project docs

- [CHANGELOG.md](CHANGELOG.md)
- [TODO.md](TODO.md)

## licensed under mpl2
