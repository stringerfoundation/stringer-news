# Content permissions and legal review

Last reviewed: 11 September 2026. This is an operational record of unresolved permissions, not a legal opinion or a finding that a publisher's content is unlawful to use. Applicable law and enforceability of terms depend on jurisdiction and circumstances; the foundation should obtain legal review before enabling third-party syndication.

## Current publication policy

`CONTENT_PERMISSIONS` in `news-model.js` is the publication gate. Missing permissions default to disabled. Collection skips sources without text permission, publishes no retained stories for them, and marks them `paused` with no successful collection date. The browser applies the same policy to old snapshots. Image permission is separate from text permission and requires an explicit grant, including during failure recovery. Only Stringer has that grant recorded.

| Source | Text publication | Story images | Basis / unresolved work |
| --- | --- | --- | --- |
| BBC | Paused | Disabled | No permission recorded for this foundation portal. |
| The New York Times | Paused | Disabled | Current RSS reuse permission has not been verified. |
| Al Jazeera | Paused | Disabled | No applicable syndication grant recorded. |
| DW | Paused | Disabled | Public RSS availability is not being treated as partner authorization. |
| Stringer courageous-stories page | Enabled | Enabled | The site owner requested reuse of the editorial collection and explicitly confirmed “Stringer photos are fine” on 11 September 2026. This records the owner’s authorization for this portal, not an independent audit of underlying licenses. Scope is the photos matched to stories on Stringer’s courageous-stories page, not arbitrary images from the linked publishers. |

The global column currently offers ordinary links to publisher home/section pages instead of imported items. The Stringer logo and favicons remain under the owner's branding instruction; that instruction is not a grant to reuse unrelated third-party marks. Original decorative graphics remain.

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
