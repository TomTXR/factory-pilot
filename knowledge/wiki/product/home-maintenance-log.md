# Home Maintenance Log

> Sources: Factory spike team, 2026-11-17 (SYNTHETIC)
> Raw: [Product brief](../../raw/product/2026-11-17-pilot-product-brief.md); [Interview Anna](../../raw/users/2026-11-17-interview-owner-anna.md)
> Updated: 2026-11-17

## Overview

The Home Maintenance Log lets private home owners record properties, the items in them that need care, and maintenance entries with date, description, cost and who did the work. Version 1 focuses on overview and cost transparency, grouped by the DomiGO value categories. SYNTHETIC product definition for the factory spike.

## Data model (version 1)

| Entity | Fields | Notes |
|--------|--------|-------|
| Property | name, address | A house or an apartment |
| Item | property, name, category | Examples: heating, roof, smoke detectors |
| Maintenance entry | item, date, description, cost (EUR), done by | Cost may be 0 (self-done work is still logged, per interview) |

## Requirements

- Overview per property: what was maintained when, and what it cost.
- Totals per year and per value category ([GO categories](../domain/go-categories.md)).
- Mobile first: entries are logged on site on a phone ([owner persona](../users/home-owner.md)).
- Amounts in EUR, dates in day-month-year order (NL / DE users).

## Out of scope (version 1)

Accounts and login, reminders, document uploads, sharing with tenants or contractors, multiple currencies.

## See Also

- [GO value categories](../domain/go-categories.md)
- [Home owner persona](../users/home-owner.md)
