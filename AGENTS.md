# Project instructions

## Repository and hosting
- Canonical repository: https://github.com/stringerfoundation/stringer-news (origin).
- Main branch: `main`.
- GitHub Pages URL: https://stringerfoundation.github.io/stringer-news/.
- Deploy through `.github/workflows/pages.yml` on pushes to `main` or manual workflow dispatch. Use GitHub Pages for this project; do not introduce another hosting service unless requested.
- This is a static HTML/CSS/JavaScript site with no build step or backend. Keep asset paths relative so they work under `/stringer-news/`.
- Publish only the site assets, not repository instructions or development files.

## Content and implementation
- Follow `LEGAL.md` and the explicit `CONTENT_PERMISSIONS` gates. Do not enable publisher text or story images without recording reviewed reuse permission. RSS availability and attribution alone are not clearance.
- Keep global publisher headlines and Stringer journalists' reporting in separate columns.
- Preserve attribution and links to original sources. Distinguish publisher-owned accounts from third-party mirrors.
- Render remote content as text; never inject untrusted feed HTML into the page. Restrict outbound story URLs to HTTP(S).
- Display real loading, empty, and failure states. Do not invent stories, journalists, timestamps, or successful refreshes.
- Nostr reporting needs explicitly configured journalist public keys. Do not substitute arbitrary accounts.
- Public Mastodon feeds may be incomplete or unavailable; do not claim they contain every publisher story.

## Working and verification
- Preserve concurrent and unrelated work. Stage explicit files and inspect the staged diff before committing.
- Check JavaScript syntax and relevant browser behavior after code changes, including refresh, source filters, unavailable feeds, and mobile layout.
- A push to `main` deploys publicly. When a push is requested, check the Pages workflow result and report its status and URL.
- Never commit credentials or private Nostr keys.
