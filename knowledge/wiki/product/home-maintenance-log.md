# Home Maintenance Log

> Sources: Factory spike team, 2026-11-17 (SYNTHETIC); product owner answers on issue #20, 2026-11-18
> Raw: [Product brief](../../raw/product/2026-11-17-pilot-product-brief.md); [Interview Anna](../../raw/users/2026-11-17-interview-owner-anna.md); [Story 20 properties](../../raw/stories/2026-11-18-story-20-manage-properties.md)
> Updated: 2026-11-18

## Overview

The Home Maintenance Log lets private home owners record properties, the items in them that need care, and maintenance entries with date, description, cost and who did the work. Version 1 focuses on overview and cost transparency, grouped by the DomiGO value categories. SYNTHETIC product definition for the factory spike.

## Data model (version 1)

| Entity | Fields | Notes |
|--------|--------|-------|
| Property | display name (optional), street, house number, house number addition (optional), postal code, city, country (NL default, or DE), owner name, optional characteristics | A house or an apartment. See Properties below |
| Item | property, name, category | Examples: heating, roof, smoke detectors |
| Maintenance entry | item, date, description, cost (EUR), done by | Cost may be 0 (self-done work is still logged, per interview) |

## Properties

Source: [Story 20 properties](../../raw/stories/2026-11-18-story-20-manage-properties.md).

- A property is identified by its postal address (street, house number, addition, postal code, city, country) plus the owner name (person or entity). Comparison ignores case and surrounding or repeated whitespace. The same address with another owner, or the same owner at another address or addition, is a different property. A duplicate is rejected (API 409).
- Required: street, house number, postal code, city, owner name. Optional: display name (the property switcher shows it, falling back to street and house number), addition, country (Netherlands by default, Germany selectable).
- Optional characteristics: property type (house, apartment, other), year built (1500 up to the current year), living area in m2 (above 0), number of rooms (whole number, at least 1), free-text notes.
- Users can add, switch between, view, edit and permanently delete (hard delete, after confirmation) properties. The selected property is remembered per browser; there is no login.
- Maintenance entries and items for a property do not exist yet. When they are added, the story must define what happens to them when a property is deleted.

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
