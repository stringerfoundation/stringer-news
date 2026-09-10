# Stringer news portal

## Summary

Update the existing static site to match Stringer's main website, with two headline-led columns: **Global Newswire** on the left and **Stringer's Courageous Stories** on the right.

Canonical repository: [stringerfoundation/stringer-news](https://github.com/stringerfoundation/stringer-news). Keep GitHub Pages, relative asset paths, and no visitor-facing backend. Keep this plan outside the published artifact.

## Design and content

- Match [Stringer's website](https://stringerjournalism.org/) using its logo, Montserrat/Barlow typography, colours, navigation, and donation link.
- Replace the oversized introduction with compact headlines, separators, and aligned column headings.
- Use equal-width desktop columns. Below 768px, stack Global Newswire first and provide jump links to both sections.
- Mirror only the [Courageous Stories page](https://stringerjournalism.org/courageous-stories), preserving editorial order and all valid entries.
- Display each story's title, journalist credits, supplied description, and original story link. Preserve team credits and editorially selected video, social-platform, and book links.
- Treat “25 finalists” as an award cohort, not a required story count. Do not invent dates, credits, entries, or exclusivity claims.
- Remove the journalist directory, source filters, “Sources,” “About Nostr,” and social-feed integrations. Remove their scripts and workflow references, and update the README.

## Collection and published data

- Collect publisher RSS in GitHub Actions, using these configured endpoints:
  - BBC World: `https://feeds.bbci.co.uk/news/world/rss.xml`
  - NYT World: `https://rss.nytimes.com/services/xml/rss/nyt/World.xml`
  - Al Jazeera: `https://www.aljazeera.com/xml/rss/all.xml`
  - DW: `https://rss.dw.com/rdf/rss-en-all`
- Verify that each endpoint returns usable feed content during implementation. Report failures without silently substituting another source.
- Use Node.js with locked HTML/XML parser dependencies. Set bounded request timeouts and retries.
- Deduplicate each publisher's items before selecting up to 30 newest for desktop column balancing. Merge newest-first and deduplicate shared URLs deterministically. Remove fragments for comparison, preserve query parameters, and place undated items last in source order.
- Keep attribution and feed-provided short summaries. Include HTTPS images and photo credits supplied by RSS media metadata; omit full text. Match Stringer images by linked story URL, with no positional guesses.
- Extract Stringer story groups from its editorial content, excluding navigation and footer. Validate title, credits, description, and HTTP(S) destination; preserve Unicode and credits verbatim. Rebalance the desktop newswire with enough distinct real headlines to reach the Stringer collection; retain a bounded stacked mobile list.
- Reject empty extraction, incomplete story groups, and reductions exceeding 25% of the previous successful Stringer count. Retain previous content and require an explicit reviewed baseline reset for legitimate larger reductions.
- Publish `data/news.json` with a schema version, snapshot generation time, per-source stories, latest attempt time, last successful collection time, and latest attempt status/error. Publication dates remain nullable and separate.

## Recovery, scheduling, and browser behaviour

- Extend the existing Pages workflow to collect on pushes to `main`, manual runs, and every 30 minutes, offset from the hour. Scheduling is a refresh target, not a guarantee.
- Recover and validate the previous published snapshot before collection. Resolve its URL from the configured Pages location so recovery follows repository transfers and custom-domain changes.
- On individual source failure, retain that source's last successful content and success timestamp; update its attempt/error metadata.
- If recovery fails, deploy only when every source collects successfully. Allow a first deployment without previous data only when all sources succeed.
- If all sources fail but recovery succeeds, publish retained stories with updated failure metadata.
- Stage only site assets and generated JSON. Keep collection scripts, dependencies, fixtures, tests, and `PLAN.md` outside the public artifact.
- Fetch the relative JSON asset on arrival, every five minutes while visible, and on Refresh. On becoming visible, fetch if five minutes have elapsed.
- Prevent overlapping requests and request cache revalidation. Preserve displayed stories when refresh fails.
- Show loading, valid empty, unavailable, and retained-content failure states. Mark sources stale after two hours without successful collection, including when scheduled runs stop.
- Refresh retrieves the latest published snapshot; it does not trigger collection or advance successful collection timestamps.
- Render remote content as text and allow only HTTP(S) story links.

## Verification and release

- Test saved source fixtures covering teams, Unicode, missing dates, duplicate URLs, meaningful query parameters, malformed feeds, and changed or partially changed Stringer markup.
- Verify individual and total failures, invalid previous snapshots, recovery outages, first deployment, count-reduction rejection, and unchanged snapshot refreshes.
- Check JavaScript syntax, keyboard access, refresh behaviour, removed controls, and layouts at 375px, 768px, and desktop widths.
- Verify relative assets and snapshot recovery at both `/stringer-news/` and a domain root.
- Document domain ownership verification, setting `news.stringerjournalism.org` in GitHub Pages, setting the DNS `news` CNAME to `stringerfoundation.github.io`, checking DNS, and enabling HTTPS. The CNAME target reflects the repository's new organization owner. A repository `CNAME` file is unnecessary for the custom Actions deployment. Follow [GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
- Keep the existing configured hostname until domain access is available. After an authorized production push, verify the Pages workflow and live JSON, and report deployment status and URL.
- First release requires no CMS, visitor login, or persistent backend.
