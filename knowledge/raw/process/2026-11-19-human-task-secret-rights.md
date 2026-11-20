# Human tasks that store secrets need the repository owner

> Source: Message from approver AxemanNL (Jesse) about story #57, relayed by the product owner, 2026-11-19
> Collected: 2026-11-19
> Published: 2026-11-19
> Synthetic: no

Jesse got a Kadaster BAG API (Individuele Bevragingen) key for story #57. The plan may not need it (keyless PDOK first). If it does, it must be stored as repository secret PILOT_BAG_API_KEY, and Jesse has no rights to add secrets. He asked whether the operator adds it or gives him admin access.

Facts checked on 2026-11-19: the repository belongs to a personal account (owner type User). Collaborators on a personal repository have write access only; GitHub offers no admin role there. AxemanNL has write. Only the owner (TomTXR) can store repository secrets.

Decision (product owner): no admin. The key goes to the owner through a private channel outside GitHub; the owner stores it with `gh secret set PILOT_BAG_API_KEY`. Admin would also allow changing branch protection and the approver list, which bypasses the factory's human gates.

Gap: the factory assigns human tasks to the approver of the story. A task that stores a secret cannot be completed by an approver who is not the owner. Not fixed yet; in v2 an organization can give a secrets role to selected people.
