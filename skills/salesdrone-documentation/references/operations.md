# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Material 3 v2 publication

Use current synthetic captures for every changed surface, retaining actual widths,
privacy review and hashes in the manifest. Update README/technical/product/settings
references together and remove obsolete local-approval holds after the explicit
user approval. The v2 review guide records browser measurements and remaining
limits; do not replace these with a blanket E2E claim. Documentation builds and
Pages postchecks must use exact release version and source commit.


## SDLC layout

The SDLC guide has a scoped editorial layout with a desktop chapter directory,
responsive connected lifecycle map, explicit failure branches and a separate
Actions dependency diagram. Use block paragraphs inside free-form containers:
Astryx Text defaults to inline even with a paragraph tag. Link typography must
account for Astryx's inner text wrapper. Review actual text wrapping, connector
placement, short-window navigation and enlarged text; an overflow-only assertion
cannot verify visual hierarchy. Keep these styles isolated from other docs pages.
