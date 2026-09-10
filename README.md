# Stringer news portal

A frontend-only news reader pairing **Global Newswire** with **Stringer's Courageous Stories**. The site uses plain HTML, CSS, and JavaScript on GitHub Pages. There is no visitor-facing server, database, CMS, or login.

Repository: https://github.com/The-Stringer-Foundation/ingestr

## How automatic updates work

GitHub Actions runs the collector at approximately 13 and 43 minutes past each hour, on pushes to `main`, and on manual workflow runs. It reads the four configured publisher RSS feeds and Stringer's editorial page, then publishes `data/news.json` with the site. This is a short scheduled collection job, not an always-running backend. GitHub schedules can be delayed; inactive public repositories may have scheduled workflows disabled by GitHub.

Browsers fetch that relative JSON file on arrival, every five minutes while visible, and on returning to a tab after five minutes. Updates happen automatically without a manual Refresh control. Successful collection timestamps stay in the JSON; the page shows status messages only for loading, empty results, failures, or stale collections. Browsers never need to fetch publisher feeds or scrape Stringer's website, so publisher cross-origin restrictions do not affect visitors.

The newswire uses BBC World, NYT World, Al Jazeera, and DW. The exact endpoints are in `news-model.js`; source changes require review. RSS descriptions are reduced to plain-text snippets. Each publisher contributes at most five unique items; the combined list is sorted by publication date, with undated stories last. URL fragments are ignored for deduplication, while query parameters are preserved.

The right column mirrors only https://stringerjournalism.org/courageous-stories, in editorial order. Its inspected page contains 24 story entries, including team credits and selected video, social-platform, and book links. The 25 finalists are an award cohort, not a required story count. No publication dates are inferred for this collection. No RSS was advertised in the page HTML; the checked `/rss.xml`, `/feed`, `/feed.xml`, and `/courageous-stories/rss.xml` endpoints returned 404 during implementation.

## Local development

Use Node.js 22 or newer:

```sh
npm ci
PAGES_URL=https://the-stringer-foundation.github.io/ingestr/ npm run collect
python3 -m http.server 4173
```

Open http://localhost:4173/. Set `PAGES_URL` to the currently configured Pages address if it differs. The generated `data/news.json` is ignored by Git; it is collected during deployment. The first local collection requires all five live sources to succeed if a valid published snapshot cannot be recovered.

Checks:

```sh
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite serves isolated saved fixtures and covers 375px, 768px, desktop, root/project paths, keyboard access, refresh failures, empty collections, source failures, unsafe content, staleness, and visibility polling. Screenshots are written to `.test-output/`. To use an installed Chrome instead, set `CHROME_PATH` to its executable. Fixture content comes from the configured sources and is excluded from the published site.

## Snapshot contract and recovery

`data/news.json` has `schemaVersion: 1`, an ISO `generatedAt` timestamp, and `sources` keyed by `bbc`, `nyt`, `aljazeera`, `dw`, and `stringer`. Each source contains:

- `stories`: title, HTTP(S) URL, plain-text summary, nullable ISO `publishedAt`; Stringer stories additionally contain the verbatim journalist `credits`.
- `attemptedAt`: time the latest collection attempt started.
- `lastSuccessAt`: time of the last successful collection, or null if none exists.
- `status`: `success` or `failure`; `error` is null on success and a diagnostic string on failure.

The collector resolves the previous snapshot from `actions/configure-pages`'s `base_url` output, so recovery follows the configured hostname and repository path. A recovered snapshot is validated before use. On a source failure, its stories and last success time are retained, while attempt/error metadata advances. If recovery is unavailable or invalid, **all five sources must succeed** before deployment. Otherwise the job fails and leaves the existing deployment intact. If all sources fail with valid recovery, retained stories are republished with failure metadata.

The browser marks a collection stale two hours after that source's last success, even if scheduled collection has stopped. A browser fetch failure preserves the currently displayed snapshot. Snapshot download times are never presented as successful upstream collection times.

Stringer extraction rejects incomplete groups, changed text-group structure, empty results, and count reductions exceeding 25% of the previous successful collection. For an intentional larger reduction, compare the changed source page with the retained collection, review every removed entry, then manually run the Pages workflow with **Reviewed Stringer reduction** enabled. This bypasses only the count guard for that run; structural and field validation still apply. Never enable it simply to clear an unexplained parser failure.

## Deployment and domain preparation

`.github/workflows/pages.yml` publishes an explicit allowlist: `index.html`, `style.css`, `app.js`, `news-model.js`, the Stringer logo and favicons, and generated JSON. Instructions, this README, `PLAN.md`, dependencies, tests, and collection scripts remain in the repository and are not included in the Pages artifact. A push to `main` deploys publicly. After publishing, check the workflow, live page, and live `data/news.json`; failures are recorded in workflow logs and source metadata.

The current GitHub Pages hostname is not changed by this implementation. When domain access is available:

1. Verify ownership of `stringerjournalism.org` in the GitHub organization's Pages settings using the TXT record GitHub supplies. Wait for verification.
2. In `The-Stringer-Foundation/ingestr` → Settings → Pages, save `news.stringerjournalism.org` as the custom domain.
3. In the domain's authoritative DNS settings (Hostinger if it manages DNS), set the **`news` CNAME** to **`the-stringer-foundation.github.io`**. Replace only conflicting records for `news`; leave the main website and email records alone. Do not include `/ingestr/` in the CNAME target.
4. Check DNS propagation and GitHub Pages' domain check, then enable **Enforce HTTPS** once the certificate is available.
5. Check `https://news.stringerjournalism.org/`, its `data/news.json`, and a collection run to verify recovery uses the new address. All site asset paths remain relative.

No repository `CNAME` file is required for a custom Actions deployment. Follow GitHub's domain instructions: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

The logo and typography follow the Stringer website. All story links retain their original publisher attribution; the site does not rehost articles.

## Branding regression checks

`tests/fixtures/branding.json` records logo dimensions, navigation/button sizes, colours, and image hashes measured from the main Stringer website. Tests require a loaded linked logo at desktop/mobile sizes, working favicons at both URL paths, the matching brown-to-orange button and icon hover states, and black navigation hover. The footer keeps donation and nonprofit information at readable body sizes. Asset checks run on every collection; browser checks also run before push/manual deployments. Update the baseline only after reviewing an intentional main-site branding change.
