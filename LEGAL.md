# Content permissions and legal review

Last reviewed: 11 September 2026. This is an operational record of unresolved permissions, not a legal opinion or a finding that a publisher's content is unlawful to use. Applicable law and enforceability of terms depend on jurisdiction and circumstances; the foundation should obtain legal review before enabling third-party syndication.

## Current publication policy

On 11 September 2026, after discussing the unresolved feed terms and relative risks, the user explicitly directed: “go for the Headline + publisher + link option now”. This supersedes the earlier pause for that narrow display scope. It is project-owner authorization to proceed, not publisher permission or a legal clearance claim. Publisher summaries and images remain disabled.

`CONTENT_PERMISSIONS` in `news-model.js` is the publication gate. Missing permissions default to disabled. Collection skips sources without text permission, publishes no retained stories for them, and marks them `paused` with no successful collection date. The browser applies the same policy to old snapshots. Image permission is separate from text permission and requires an explicit grant, including during failure recovery. Only Stringer has image authorization recorded. Global headline publication follows the user decision below, not a newly obtained publisher license.

| Source | Text publication | Story images | Basis / unresolved work |
| --- | --- | --- | --- |
| BBC | Headlines and links only | Disabled | No permission recorded for this foundation portal. |
| The New York Times | Headlines and links only | Disabled | Current RSS reuse permission has not been verified. |
| Al Jazeera | Headlines and links only | Disabled | No applicable syndication grant recorded. |
| DW | Headlines and links only | Disabled | Public RSS availability is not being treated as partner authorization. |
| Stringer courageous-stories page | Enabled | Enabled | The site owner requested reuse of the editorial collection and explicitly confirmed “Stringer photos are fine” on 11 September 2026. This records the owner’s authorization for this portal, not an independent audit of underlying licenses. Scope is the photos matched to stories on Stringer’s courageous-stories page, not arbitrary images from the linked publishers. |

The global column now displays imported headlines, publisher names, and original article links only. Copied summaries and publisher photos are stripped from both newly collected and retained data. Publication timestamps are retained for sorting but not displayed. The Stringer logo and favicons remain under the owner's branding instruction; that instruction is not a grant to reuse unrelated third-party marks. Original decorative graphics remain.

## Research notes and sources

- [BBC terms, 31 March 2022, section 15](https://downloads.bbc.co.uk/usingthebbc/bbc_terms_of_use_31March2022english.pdf) distinguish personal RSS use subject to conditions from business use requiring permission. This is a dated document, not verification of current terms. The current terms page could not be retrieved during review. Do not assume nonprofit status qualifies the portal for personal use.
- [Al Jazeera terms, section 6](https://terms.aljazeera.net/) restrict general use to personal, noncommercial purposes and require permission for reproduction. Verify whether a specific agreement or RSS license supersedes those general terms for the proposed use.
- [DW's German News Service](https://amp.dw.com/en/benefit-from-smart-content-made-in-germany/a-19470839) describes an organizational syndication route with its own terms and contact, gns@dw.com. This is not evidence that our currently configured public feed is licensed for this use.
- NYT's current RSS-specific terms could not be verified during review. No permission is inferred from the feed's availability.
- [US Copyright Office fair-use guidance](https://www.copyright.gov/fair-use/) explains the case-specific four-factor analysis. There is no universal safe number of sentences or words, and nonprofit use is not automatically fair use. US guidance does not resolve other jurisdictions.

An RSS URL is a delivery mechanism, not itself a blanket license. Attribution and links do not replace permission. Serving an image from its original host rather than copying its bytes is not treated here as rights clearance. Headlines, excerpts, photos, and automated collection may have different restrictions. Earlier proposal language suggesting a universally compliant headline/snippet/link formula must not be relied upon.

## Before enabling content

For each source, record a reviewed license or written permission, the rights holder, reviewer and date, covered domains and uses, attribution/link requirements, allowed text length and modifications, image rights (including agency photographs), retention limits, expiry/revocation terms, and any fees. Confirm that the foundation's portal and donation links fit the grant. Store confidential agreements privately; put only a non-sensitive reference here, never credentials or private correspondence.

Then implement any grant-specific constraints before changing the source's text or image flag. A blanket source image flag is appropriate only if the grant covers every image selected by that parser; otherwise add an asset-specific allowlist first. Run collector and browser tests and verify the generated JSON and deployed site. On revocation, disable the relevant permission and redeploy; old recovery snapshots must not restore withdrawn content.

The existing parser/browser tests use explicitly fictional grants to exercise enabled-source behavior. Those test overrides are not publisher authorizations. Separate regression tests exercise production defaults and verify that old snapshots cannot trigger unapproved publisher-image requests or restore paused publisher stories; owner-approved Stringer photos remain enabled.

## Repository and deployment scope

These notes are repository-only and excluded from the Pages artifact. Raw source fixtures already exist in repository history and are also excluded from Pages. Their presence is not a license to redistribute them; include fixtures and historical snapshots in the foundation's rights review, replacing them with synthetic fixtures if clearance is unavailable. This change does not rewrite repository history or erase third-party caches of earlier deployments.

## Social media alternatives

Copying text or image URLs out of social posts is not assumed to grant republication rights. Use publisher-owned accounts rather than unofficial mirrors, and verify the platform terms and the poster's authority over included images. An official embed is a distinct integration, not permission to extract assets into our own cards.

[X supports official post embeds including photos and videos](https://help.x.com/en/using-x/how-to-embed-a-post); its [display requirements](https://docs.x.com/developer-terms/display-requirements) cover attribution, branding, presentation, and edits. Any proposed integration must follow those requirements and account for removed/unavailable posts. Platform support for embedding is not recorded here as blanket clearance of every underlying photo. No social integration has been enabled by this review.

### Mastodon, Bluesky, and Nostr account findings

Checked 11 September 2026. These are discovery notes, not a live feed audit or reuse authorization. “Not confirmed” means the review did not establish an official account; it does not prove that none exists. Profile names and claims of being “official” alone are insufficient evidence.

| Publisher | Bluesky | Mastodon | Nostr |
| --- | --- | --- | --- |
| BBC | BBC-branded profiles found, but a main publisher-owned news account was not verified. | [social.bbc](https://social.bbc/about) is the BBC's server; specialist accounts were found, not a verified complete World news feed. | [BBC News (NewsBot)](https://damus.io/npub1n3wsckgal6qqy5renf7pccm0sv2xj4n8wjnp9yds30fupe8q37uqv77ykq) and RSS-style mirrors were found; BBC ownership was not established. |
| The New York Times | [@nytimes.com](https://bsky.app/profile/nytimes.com), using the publisher's domain handle. | No official main news account confirmed. | No official account confirmed. |
| Al Jazeera | [@aljazeera.com](https://bsky.app/profile/aljazeera.com), using the publisher's domain handle. | No official main news account confirmed. | No official account confirmed. |
| DW | [@deutschewelle.dw.com](https://bsky.app/profile/deutschewelle.dw.com), corporate communications rather than a general English-language newswire. | [DW Innovation's announcement](https://innovation.dw.com/articles/dw-innovation-mastodon-fediverse) identifies `@dw_innovation@mastodon.social`; its scope is technology/R&D, not a general world-news feed. The announcement is historical and does not establish current posting activity. | No official account confirmed. |

NYT and Al Jazeera on Bluesky are candidates for further evaluation, not enabled sources. Before implementation, recheck publisher ownership through domain verification or a publisher-site link, inspect current activity and original-story links, and evaluate how much of the desired coverage is actually posted. Domain ownership does not establish rights to every attached photograph. Unofficial mirrors must be identified as such and cannot grant rights they do not hold.

### Privacy and implementation considerations

- The user's preference is to avoid social embeds because of visitor privacy. Do not introduce social widgets as a shortcut for rights clearance.
- A potential integration would collect permitted public posts in the existing scheduled job and publish sanitized text and original links in static JSON. Visitors would not need to contact social platforms merely to read that text. Remote images, avatars, scripts, and embeds would introduce third-party requests and need separate consideration.
- Public APIs, federation, RSS, and Nostr relay availability are technical access mechanisms. Review the applicable terms and rights before enabling publication through `CONTENT_PERMISSIONS`; protocol openness is not being treated as a blanket republication license.
- Social feeds may omit stories, contain replies/reposts or promotional content, change handles, become unavailable, or remove posts. Do not promise complete coverage. Define filtering, update/deletion handling, attribution, and failure behavior before replacing any RSS source.
- For Nostr, establish publisher ownership of the exact public key before configuring it. The bot link above is a research reference, not an approved key or journalist source. Never substitute arbitrary accounts or unofficial mirrors for configured journalists.

No Mastodon, Bluesky, or Nostr integration is enabled by these notes. The headline-only decision uses the existing publisher RSS endpoints.
