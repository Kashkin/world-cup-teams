## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# Project conventions

## Toolchain

- Package manager: **pnpm** (locked via `packageManager` in `package.json`). Do not use npm or yarn.
- Node: see `.nvmrc` (and the `engines.node` floor in `package.json`).
- Language: TypeScript.
- Linter: ESLint flat config (`eslint.config.js`).
- Formatter: Prettier.
- Tests: Vitest.

## Hard rules before declaring work complete

1. Run `pnpm lint`. Must exit 0.
2. Run `pnpm format:check`. Must exit 0.
3. Run `pnpm test` if tests exist.
4. If any of the above fails, fix it before claiming the task is done.

If `lint`, `format:check`, or `test` is missing from `package.json`, that is a regression — restore it rather than working around it.

## Hooks active in this project

- `.claude/settings.json`: auto-runs Prettier + ESLint after every `Edit`/`Write`/`MultiEdit`; full lint + format check on `Stop`.
- `lefthook.yml`: pre-commit runs `pnpm lint` and `pnpm format:check`.

Never bypass hooks with `--no-verify` without explicit user approval.

## Style

- `"type": "module"` — use ESM imports, not `require`.
- Prefer `import type` for type-only imports.
- Avoid `any`. Use `unknown` + narrowing.
- Avoid floating promises — always `await` or handle explicitly.

## SvelteKit conventions

- Svelte 5 **runes only** (`$state`, `$derived`, `$effect`). No legacy reactive syntax (`$:`).
- Stores allowed only for cross-component shared state that can't be colocated.
- Runes fire client-side — do not use in SSR-only files (`+page.server.ts`, `+layout.server.ts`).
- Load functions: prefer typed `load()` with `depends()` for invalidation; avoid fetch-in-component.
- Forms: use `<form use:enhance>` + server `actions` by default. Only reach for client-side fetch if you specifically need it.

## Tailwind gotcha

In `vite.config.ts` the **Tailwind plugin must come before `sveltekit()`** in the plugin array. Reversed order breaks JIT on first build.

## CSS imports

Global CSS goes in root `+layout.svelte`'s `<style>` block or imported from it. Per-route imports leak between routes in dev mode.

## Icons — @lucide/svelte

Always use deep imports:

```ts
import Camera from '@lucide/svelte/icons/camera';
```

Never import from the barrel (`from '@lucide/svelte'`) — ESLint `no-restricted-imports` will block it. The barrel triggers Vite to dep-optimise ~27 MB of icon modules.

## Svelte MCP

The project ships `.mcp.json` with the official `@sveltejs/mcp` server. Use it for Svelte 5 / SvelteKit documentation lookups:

- `list-sections` — call first to discover available docs; returns titles, use-cases, paths.
- `get-documentation` — fetch full content for one or more sections. After `list-sections`, read the `use_cases` field, then fetch every section relevant to the task.
- `svelte-autofixer` — analyse Svelte code for issues; call repeatedly until it returns none before handing code back.
- `playground-link` — generate a Svelte Playground URL. Only call after the user explicitly asks for one, and never for code already written to files.

## shadcn-svelte docs

If the project uses shadcn-svelte, fetch the relevant docs before writing or editing components:

- Index: https://www.shadcn-svelte.com/llms.txt
- Per-component: `https://shadcn-svelte.com/docs/<component>.md` (e.g. `button.md`)

Read the `.md` doc page for every component you're touching — the rendered site HTML is noisier.
