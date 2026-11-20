# Story 18: Show the app version in the footer (backfilled)

> Source: GitHub issue #18, TomTXR/factory-pilot, plan and product owner comments; backfilled from the issue by story #63
> Collected: 2026-11-19
> Published: 2026-11-18
> Synthetic: no

## Goal

The web app shows a footer "Version <value>", read from the existing `GET /api/version` endpoint. If the API cannot be reached, the footer shows "Version unknown". It must be readable on a 390 px wide phone and on desktop.

## Questions and product owner answers

Plan comment: https://github.com/TomTXR/factory-pilot/issues/18#issuecomment-6972217544

1. Short commit of 7 characters? Yes, as proposed (https://github.com/TomTXR/factory-pilot/issues/18#issuecomment-6972222995).
2. While loading, show nothing? Yes, as proposed (same comment).

## Changes requested

- After the first test request the product owner wrote: "No the version should follow standard versioning schema x.y.z" (https://github.com/TomTXR/factory-pilot/issues/18#issuecomment-6983293094). This replaced the short commit with a semantic version. The code now reads the version from `api/package.json` (`api/src/server.ts`).
- The pull request #19 was merged as fabf7b0 and deployed on 2026-11-18 (https://github.com/TomTXR/factory-pilot/issues/18#issuecomment-6987126581).

## Decisions

- The version is the `version` field of `api/package.json`, shown as "Version x.y.z" (product owner request above; implementation in the code).
- Out of scope: automatic version bumping. The sources do not say how the number changes.
