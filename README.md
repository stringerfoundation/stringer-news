# ingestr

Stringer World Desk pairs mainstream headlines with a space for independent reporting on Nostr.

**Website:** https://the-stringer-foundation.github.io/ingestr/

## Development

The site is plain HTML, CSS, and JavaScript, with no installation or build step.
Serve the repository locally, for example with `python3 -m http.server 4173`,
then open http://localhost:4173/.

BBC News and CNN headlines are fetched from their federated Flipboard accounts
through the public Mastodon API. Availability and completeness depend on that
server. The Nostr column remains unconnected until journalist public keys are supplied.

## Deployment

GitHub Pages uses the GitHub Actions workflow in `.github/workflows/pages.yml`.
Every push to `main` publishes `index.html`, `style.css`, and `app.js`.
The workflow can also be run manually. Keep asset references relative for the
`/ingestr/` project path. Add new public assets to the workflow's staging step.

See `AGENTS.md` for project conventions.
