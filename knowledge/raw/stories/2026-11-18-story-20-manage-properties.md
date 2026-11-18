# Story 20: Being able to manage properties

> Source: GitHub issue #20, TomTXR/factory-pilot, plan and product owner answers
> Collected: 2026-11-18
> Published: 2026-11-18
> Synthetic: yes

## Goal

A home owner can add, switch between, view, edit and delete properties. A property is uniquely identified by its postal address plus the owner (person or entity) name, and can carry optional key characteristics. The main view shows an "add your first property" call to action when empty, an "add property" option when properties exist, and a property data view for the selected property.

## Questions and product owner answers

1. Should the user give a display name used in the switcher? Yes, optional; the switcher falls back to street and house number.
2. Which address fields are required and which countries? Required: street, house number, postal code, city. Country optional, default Netherlands, Germany also selectable.
3. Is a house number addition part of the address identity? Yes (optional "addition" field is part of the unique key).
4. Which characteristics? Property type (house, apartment, other), year built, living area in m2, number of rooms, free-text notes.
5. Deletion? Permanent hard delete after confirmation.
6. Is editing needed now? Yes. The product owner: "we should add editing as well, this is expected by a user" (this reversed the proposed default of no).
7. Remember the selected property across visits? Yes, per browser.

## Decisions

- Uniqueness is enforced in the database with a unique index on the normalised (lower-cased, whitespace-collapsed) address, addition, country and owner.
- Out of scope: items, maintenance entries, cost totals and their cascade rules; accounts; address lookup; photos; soft delete; countries other than NL and DE; change history.
