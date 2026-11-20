# Server-side sessions last 30 days from last use, with hashed tokens

> Sources: Story #28, product owner answer 6 on https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005844848 ("probably 30 days is a good time"); refined plan https://github.com/TomTXR/factory-pilot/issues/28#issuecomment-7005992740; `api/src/auth.ts`, `api/src/authRoutes.ts`
> Raw: [Story 34 Google sign-in](../../raw/stories/2026-11-19-story-34-google-sign-in.md)
> Status: accepted
> Updated: 2026-11-19

## Context

The product owner asked what is best practice for the session length on a phone.

## Decision

A session lasts 30 days (`SESSION_TTL_MS`) from last use. It is stored server-side; the cookie holds a random token and only its SHA-256 hash is stored. The last use is written at most every 5 minutes (`SESSION_REFRESH_MS`). Expired sessions are purged at API start-up only. The 30 days were proposed by the agent in the plan and accepted by the product owner. The 5 minute write interval and the purge at start-up are technical choices in the code; no source states their reason.

## Reason

The plan: common practice for a low-risk personal app with server-side sessions, because sign-out and expiry take effect at once on the server. Reason for the 5 minute interval and start-up purge: unknown (code only).

## Alternatives

- Stateless signed tokens: not discussed in the sources.

## Affects

- [Sign-in with Google, sessions and API protection](../architecture/authentication.md)
