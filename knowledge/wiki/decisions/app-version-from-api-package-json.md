# The app version is the version in api/package.json, shown in the footer

> Sources: Story #18, product owner comment on https://github.com/TomTXR/factory-pilot/issues/18#issuecomment-6983293094 ("the version should follow standard versioning schema x.y.z"); `api/src/server.ts`
> Raw: [Story 18 version footer](../../raw/stories/2026-11-18-story-18-version-footer.md)
> Status: accepted
> Updated: 2026-11-19

## Context

The first build of #18 showed a short commit. The product owner rejected it.

## Decision

`GET /api/version` returns the `version` field of `api/package.json` (read at start-up). The footer shows "Version x.y.z", or "Version unknown" if the request fails.

## Reason

Product owner request for x.y.z. How the number is raised is not documented.

## Alternatives

- Short commit hash: rejected by the product owner.

## Affects

- [App version and health status](../product/app-version.md)
