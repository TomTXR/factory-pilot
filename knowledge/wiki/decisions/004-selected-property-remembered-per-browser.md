# 004: The selected property is remembered per browser and cleared on sign-out

> Sources: Story #20, product owner answer 7 on https://github.com/TomTXR/factory-pilot/issues/20#issuecomment-6980020998; sign-out clearing from `web/src/AuthGate.tsx`
> Raw: [Story 20 properties](../../raw/stories/2026-11-18-story-20-manage-properties.md)
> Status: accepted
> Updated: 2026-11-19

## Context

Users with several properties should return to the property they used last.

## Decision

The selection is stored in `localStorage` under `selectedPropertyId`. It is removed on sign-out, on a 401 and after account deletion, so a shared browser does not carry it over. The clearing on sign-out is a technical choice by the builder of #34 and #35 in the code; no issue comment states a reason beyond the shared-browser case in the #35 plan.

## Reason

The product owner accepted remembering the selection per browser. The reason for clearing it is not written down as a human answer; the code treats it as part of keeping a shared browser free of the previous user's data.

## Alternatives

- Remember per account on the server: not discussed in the sources.

## Affects

- [Property](../product/property.md)
- [Screens](../design/screens.md)
