# Operational reference

Use the current source and [shared contract](../../SHARED.md) when applying these module-specific recipes. Release dates, prior approvals and screenshot versions are historical evidence in [CHANGELOG](../../../CHANGELOG.md) and [release plans](../../../releases/); they never authorize a new deployment.

## Module verification and integration

Use salesdrone-testing and qa/test-cases.json to select automated/manual cases. npm run qa -- quick/integration/release runs bounded static scripts, stops on failure and records sanitized status. It does not authorize deployment. Review contract generation differences, real emulator results, visual screenshots and post-deploy artifacts separately; never mark blocked or not-run cases passed.

## Material 3 v2 approved release
