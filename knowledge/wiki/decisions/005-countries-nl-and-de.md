# 005: Countries are Netherlands and Germany, Netherlands is the default

> Sources: Story #20, product owner answer 2 on https://github.com/TomTXR/factory-pilot/issues/20#issuecomment-6980020998; check constraint in `api/migrations/002_properties.sql`
> Raw: [Story 20 properties](../../raw/stories/2026-11-18-story-20-manage-properties.md)
> Status: accepted
> Updated: 2026-11-19

## Context

Addresses need a country. The persona lives in the Netherlands or Germany.

## Decision

The country is optional in the form and defaults to NL. Only NL and DE are accepted; the API and a check constraint reject other values.

## Reason

The proposed default was accepted; the product brief targets NL and DE users. Other countries are out of scope in the story.

## Alternatives

- Free-text country: out of scope.

## Affects

- [Property](../product/property.md)
