# Security notes

Internal toolkit for building HTML emails. Written for reviewers: what the app does with data, what it talks to, and what risks remain.

## Data handling

- No database, no accounts, no cookies, no analytics, no telemetry.
- Files dropped into tools (CSV, images, GIFs, .eml, template folders) are processed **in the browser** and never uploaded.
- Logik persists the editor contents, target data JSON and region in `localStorage` (keys `logik-editor`, `logik-target-data`, `logik-region`). Nothing else is stored.
- Access control is not implemented in the app. It must be provided by the hosting layer (SSO / network restriction).

## Server endpoints

All in `server/api/`. Outbound requests go through `server/utils/safe-fetch.ts`, which allows only http(s), rejects URLs with credentials, resolves the host and rejects loopback, private, link-local (incl. cloud metadata), CGNAT, unique-local and reserved ranges, and re-validates every redirect hop.

| Endpoint | Purpose | Outbound target | Guard |
|---|---|---|---|
| `GET /api/imageProxy?url=` | Embed VIP images in screenshots | `res.newsletter.contact.sky` only | https + host allowlist, raster `image/*` only, 10 MB cap, `nosniff` + sandbox CSP on response |
| `GET /api/fontProxy?name=` | Embed Sky fonts in screenshots | 2 fixed `static.skyassets.com` URLs | caller picks a name, never a URL |
| `POST /api/traceRedirects` | LinkTrace: list redirect hops | any public URL (by design) | public-address check per hop, 20 hops, 10 s timeout, body never returned |
| `POST /api/vibRedirect` | VibGrab: resolve final URL | any public URL (by design) | same as above |
| `GET /api/store-movies` | Top Sky Store titles | fixed `www.skystore.com` URL | no caller input; key from `NUXT_SKYSTORE_API_KEY` |

## Browser-side outbound requests

- `static.skyassets.com` - Sky brand fonts (CSS `@font-face`).
- Image URLs contained in the user's own CSVs / templates (`<img>` only).
- Nothing else: `connect-src 'self'` in the CSP stops page scripts calling other origins. Icons are bundled (Iconify API fallback disabled). The UI font is downloaded at build time by `@nuxt/fonts` and self-hosted.

## Response headers

Set for all routes in `nuxt.config.ts`: Content-Security-Policy, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, Permissions-Policy.

## Template rendering

Logik and Spotlight Preview compile EJS templates in the browser, which executes the template's JavaScript in the page. Rendered output is shown in an iframe sandboxed without `allow-scripts`, so scripts inside the resulting email HTML do not run.

## Dependencies

Runtime (shipped to the browser):

| Package | Licence | Used for |
|---|---|---|
| ejs | Apache-2.0 | template rendering |
| acorn | MIT | EJS lint |
| monaco-editor, nuxt-monaco-editor | MIT | code editor |
| papaparse | MIT | CSV parsing |
| diff | BSD-3-Clause | Text Compare |
| detergent | MIT | LegalEez text cleanup |
| html-to-image | MIT | VIPreview screenshot |
| jszip | MIT (dual MIT / GPL-3.0) | TinyImg ZIP |
| browser-image-compression | MIT | TinyImg (pinned; worker script self-hosted) |
| gifsicle-wasm-browser | MIT wrapper, see below | Gif Fix (pinned) |

Framework / build: nuxt, @nuxt/ui, @vueuse, tailwindcss, @iconify-json/lucide. Install with `npm ci` (lockfile resolves to registry.npmjs.org only).

## Known residual risks

- **CSP allows `'unsafe-eval'` and `'unsafe-inline'` for scripts.** Required by in-browser EJS compilation, wasm and Nuxt's inline hydration payload.
- **EJS templates run as code in the app origin.** Inherent to the tool. Only load templates you would be happy to run; a hostile template could read `localStorage` and call this app's endpoints, but cannot send data to another origin.
- **DNS rebinding window** in the redirect endpoints: the host is resolved for validation and again by `fetch`. Network-level egress rules are the complete fix.
- **`gifsicle-wasm-browser`** is a single-maintainer package shipping a prebuilt wasm build of gifsicle. gifsicle itself is GPL-2.0, although the npm wrapper declares MIT. It makes no network requests.
- **`browser-image-compression`** has had no release since March 2023. Kept because it does PNG palette quantisation that canvas APIs cannot. Its default CDN worker load is replaced with a same-origin copy.
- **`npm audit`** reports low/moderate advisories only, all in Nitro's build-time tooling (glob, minimatch, deepmerge, archiver) with no upstream fix yet. Not present in the deployed bundle.
- **Sky Store key history.** The Sky Store web client key was previously hardcoded and remains in git history (commit `08b676c`). It is the public key used by skystore.com's own web client.
