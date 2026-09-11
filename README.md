# Stringer news portal

A frontend-only news reader pairing **Global Newswire** with **Stringer's Courageous Stories**. The site uses plain HTML, CSS, and JavaScript on GitHub Pages. There is no visitor-facing server, database, CMS, or login.

Repository: https://github.com/stringerfoundation/stringer-news

## Content permissions

See [LEGAL.md](LEGAL.md) for the permission register, research limitations, and steps required before enabling third-party content. Global publisher imports are currently paused; the left column links directly to publishers. Stringer text and its curated story photos remain enabled under the owner’s explicit confirmation. Global publisher content and photos are disabled, including in retained snapshots. The logo, favicons, and original decorative graphics remain.

## How automatic updates work

GitHub Actions runs the collector at approximately 13 and 43 minutes past each hour, on pushes to `main`, and on manual workflow runs. It reads only permission-enabled sources (currently Stringer's editorial page), then publishes `data/news.json` with the site. This is a short scheduled collection job, not an always-running backend. GitHub schedules can be delayed; inactive public repositories may have scheduled workflows disabled by GitHub.

Browsers fetch that relative JSON file on arrival, every five minutes while visible, and on returning to a tab after five minutes. Updates happen automatically without a manual Refresh control. Successful collection timestamps stay in the JSON; the page shows status messages only for loading, empty results, failures, or stale collections. Browsers never need to fetch publisher feeds or scrape Stringer's website, so publisher cross-origin restrictions do not affect visitors.

The newswire has parsers for BBC World, NYT World, Al Jazeera, and DW, currently paused pending permission. The exact endpoints are in `news-model.js`; source changes require review. RSS descriptions are reduced to plain-text snippets. If image permission is granted, images come only from publisher-provided RSS media metadata; captions retain supplied photo credits. Stories without an image remain text-only. Each publisher contributes at most 30 unique items; the combined list is sorted by publication date, with undated stories last. URL fragments are ignored for deduplication, while query parameters are preserved.

The right column mirrors only https://stringerjournalism.org/courageous-stories, in editorial order. Its inspected page contains 24 story entries, including team credits and selected video, social-platform, and book links. The 25 finalists are an award cohort, not a required story count. No publication dates are inferred for this collection. Images are matched by their original story destinations, never by their position in the page; unmatched images remain absent. No RSS was advertised in the page HTML; the checked `/rss.xml`, `/feed`, `/feed.xml`, and `/courageous-stories/rss.xml` endpoints returned 404 during implementation.

## Local development

Use Node.js 22 or newer:

```sh
npm ci
PAGES_URL=https://stringerfoundation.github.io/stringer-news/ npm run collect
python3 -m http.server 4173
```

Open http://localhost:4173/. Set `PAGES_URL` to the currently configured Pages address if it differs. The generated `data/news.json` is ignored by Git; it is collected during deployment. The first local collection requires all enabled sources to succeed if a valid published snapshot cannot be recovered.

Checks:

```sh
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite serves isolated saved fixtures and covers 375px, 768px, desktop, root/project paths, keyboard access, refresh failures, empty collections, source failures, unsafe content, staleness, and visibility polling. Screenshots are written to `.test-output/`. To use an installed Chrome instead, set `CHROME_PATH` to its executable. Fixture content comes from the configured sources and is excluded from the published site.

## Snapshot contract and recovery

`data/news.json` has `schemaVersion: 2` (the collector and browser also accept version 1 for recovery), an ISO `generatedAt` timestamp, and `sources` keyed by `bbc`, `nyt`, `aljazeera`, `dw`, and `stringer`. Each source contains:

- `stories`: title, HTTP(S) URL, plain-text summary, nullable ISO `publishedAt`, and optional `image` with an HTTPS `url`, source-provided `alt`, and `credit`; Stringer stories additionally contain the verbatim journalist `credits`.
- `attemptedAt`: time the latest collection attempt started.
- `lastSuccessAt`: time of the last successful collection, or null if none exists.
- `status`: `success`, `failure`, or `paused`; `error` is null on success/paused and a diagnostic string on failure. Paused sources contain no stories or last success time. Their `attemptedAt` records the policy evaluation time; no upstream request was made.

The collector resolves the previous snapshot from `actions/configure-pages`'s `base_url` output, so recovery follows the configured hostname and repository path. A recovered snapshot is validated before use. On an enabled source failure, its permitted stories and last success time are retained, while attempt/error metadata advances. If recovery is unavailable or invalid, **all enabled sources must succeed** before deployment. Otherwise the job fails and leaves the existing deployment intact. If all enabled sources fail with valid recovery, permitted retained stories are republished with failure metadata. Disabled sources are never fetched or recovered for publication.

The browser marks a collection stale two hours after that source's last success, even if scheduled collection has stopped. A browser fetch failure preserves the currently displayed snapshot. Snapshot download times are never presented as successful upstream collection times.

Stringer extraction rejects incomplete groups, changed text-group structure, empty results, and count reductions exceeding 25% of the previous successful collection. For an intentional larger reduction, compare the changed source page with the retained collection, review every removed entry, then manually run the Pages workflow with **Reviewed Stringer reduction** enabled. This bypasses only the count guard for that run; structural and field validation still apply. Never enable it simply to clear an unexplained parser failure.

## Deployment and domain preparation

`.github/workflows/pages.yml` publishes an explicit allowlist: `index.html`, `style.css`, `app.js`, `news-model.js`, the Stringer logo and favicons, and generated JSON. Instructions, this README, `PLAN.md`, dependencies, tests, and collection scripts remain in the repository and are not included in the Pages artifact. A push to `main` deploys publicly. After publishing, check the workflow, live page, and live `data/news.json`; failures are recorded in workflow logs and source metadata.

The current GitHub Pages hostname is not changed by this implementation. When domain access is available:

1. Verify ownership of `stringerjournalism.org` in the GitHub organization's Pages settings using the TXT record GitHub supplies. Wait for verification.
2. In `stringerfoundation/stringer-news` → Settings → Pages, save `news.stringerjournalism.org` as the custom domain.
3. In the domain's authoritative DNS settings (Hostinger if it manages DNS), set the **`news` CNAME** to **`stringerfoundation.github.io`**. Replace only conflicting records for `news`; leave the main website and email records alone. Do not include `/stringer-news/` in the CNAME target.
4. Check DNS propagation and GitHub Pages' domain check, then enable **Enforce HTTPS** once the certificate is available.
5. Check `https://news.stringerjournalism.org/`, its `data/news.json`, and a collection run to verify recovery uses the new address. All site asset paths remain relative.

No repository `CNAME` file is required for a custom Actions deployment. Follow GitHub's domain instructions: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

The logo and typography follow the Stringer website. All story links retain their original publisher attribution; the site does not rehost articles.

## Branding regression checks

`tests/fixtures/branding.json` records logo dimensions, navigation/button sizes, colours, and image hashes measured from the main Stringer website. Tests require a loaded linked logo at desktop/mobile sizes, working favicons at both URL paths, the matching brown-to-orange button and icon hover states, and black navigation hover. The footer keeps donation and nonprofit information at readable body sizes. Asset checks run on every collection; browser checks also run before push/manual deployments. Update the baseline only after reviewing an intentional main-site branding change.

## Image cards and column balance

When separately authorized in the permission register, the reader can display lazy-loaded source images with reserved square space, preserves supplied photo credits, and removes failed images without hiding the reporting. Decorative concentric lines and orange accents echo Stringer’s visual identity. No generated or unrelated stock photos are used.

When publisher text is enabled, on desktop the newswire uses enough distinct, chronologically ordered headlines to reach the end of the Courageous Stories list, within one story card, when the collected pool is sufficient. It rebalances after resizing, font loading, or failed images; it does not stretch cards or invent filler. On mobile it shows up to the larger of 24 headlines or the Stringer story count before the stacked Stringer section. Both columns remain usable if a feed has fewer stories.
