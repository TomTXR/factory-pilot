import type { Sql } from './db.js';
import type { Property, PropertyInput, PropertyRepository } from './properties.js';

const UNIQUE_VIOLATION = '23505';

interface Row {
  id: string;
  display_name: string | null;
  street: string;
  house_number: string;
  house_number_addition: string;
  postal_code: string;
  city: string;
  country: Property['country'];
  owner_name: string;
  property_type: Property['propertyType'];
  year_built: number | null;
  living_area_m2: number | null;
  rooms: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

function toProperty(r: Row): Property {
  return {
    id: r.id,
    displayName: r.display_name,
    street: r.street,
    houseNumber: r.house_number,
    houseNumberAddition: r.house_number_addition,
    postalCode: r.postal_code,
    city: r.city,
    country: r.country,
    ownerName: r.owner_name,
    propertyType: r.property_type,
    yearBuilt: r.year_built,
    livingAreaM2: r.living_area_m2,
    rooms: r.rooms,
    notes: r.notes,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}

/** numeric columns are cast to float8 so the driver returns numbers instead of strings. */
const columns = (sql: Sql) => sql`id, display_name, street, house_number, house_number_addition, postal_code,
  city, country, owner_name, property_type, year_built, living_area_m2::float8 as living_area_m2, rooms, notes,
  created_at, updated_at`;

export function createPropertyRepository(sql: Sql): PropertyRepository {
  return {
    async list(userId) {
      const rows = await sql<Row[]>`
        select ${columns(sql)} from properties where account_user_id = ${userId} order by created_at, id`;
      return rows.map(toProperty);
    },

    async get(userId, id) {
      const rows = await sql<Row[]>`
        select ${columns(sql)} from properties where id = ${id} and account_user_id = ${userId}`;
      return rows[0] ? toProperty(rows[0]) : null;
    },

    async create(userId, p: PropertyInput) {
      try {
        const rows = await sql<Row[]>`
          insert into properties (display_name, street, house_number, house_number_addition, postal_code, city,
            country, owner_name, property_type, year_built, living_area_m2, rooms, notes, account_user_id)
          values (${p.displayName}, ${p.street}, ${p.houseNumber}, ${p.houseNumberAddition}, ${p.postalCode},
            ${p.city}, ${p.country}, ${p.ownerName}, ${p.propertyType}, ${p.yearBuilt}, ${p.livingAreaM2},
            ${p.rooms}, ${p.notes}, ${userId})
          returning ${columns(sql)}`;
        return toProperty(rows[0] as Row);
      } catch (err) {
        if (isUniqueViolation(err)) return 'duplicate';
        throw err;
      }
    },

    async update(userId, id, p: PropertyInput) {
      try {
        const rows = await sql<Row[]>`
          update properties set display_name = ${p.displayName}, street = ${p.street},
            house_number = ${p.houseNumber}, house_number_addition = ${p.houseNumberAddition},
            postal_code = ${p.postalCode}, city = ${p.city}, country = ${p.country}, owner_name = ${p.ownerName},
            property_type = ${p.propertyType}, year_built = ${p.yearBuilt}, living_area_m2 = ${p.livingAreaM2},
            rooms = ${p.rooms}, notes = ${p.notes}, updated_at = now()
          where id = ${id} and account_user_id = ${userId}
          returning ${columns(sql)}`;
        return rows[0] ? toProperty(rows[0]) : null;
      } catch (err) {
        if (isUniqueViolation(err)) return 'duplicate';
        throw err;
      }
    },

    async remove(userId, id) {
      const rows = await sql`delete from properties where id = ${id} and account_user_id = ${userId} returning id`;
      return rows.length > 0;
    },

    async claimUnowned(userId) {
      // Rows whose identity the account already has stay unowned: claiming them would break the per-account
      // unique index and abort the sign-in. No row is deleted.
      const rows = await sql`
        update properties p set account_user_id = ${userId}
        where p.account_user_id is null and not exists (
          select 1 from properties o where o.account_user_id = ${userId} and
            (lower(regexp_replace(btrim(o.street), '\s+', ' ', 'g')),
              lower(regexp_replace(btrim(o.house_number), '\s+', ' ', 'g')),
              lower(regexp_replace(btrim(o.house_number_addition), '\s+', ' ', 'g')),
              lower(regexp_replace(btrim(o.postal_code), '\s+', ' ', 'g')),
              lower(regexp_replace(btrim(o.city), '\s+', ' ', 'g')),
              o.country,
              lower(regexp_replace(btrim(o.owner_name), '\s+', ' ', 'g'))) =
            (lower(regexp_replace(btrim(p.street), '\s+', ' ', 'g')),
              lower(regexp_replace(btrim(p.house_number), '\s+', ' ', 'g')),
              lower(regexp_replace(btrim(p.house_number_addition), '\s+', ' ', 'g')),
              lower(regexp_replace(btrim(p.postal_code), '\s+', ' ', 'g')),
              lower(regexp_replace(btrim(p.city), '\s+', ' ', 'g')),
              p.country,
              lower(regexp_replace(btrim(p.owner_name), '\s+', ' ', 'g')))
        )
        returning p.id`;
      return rows.length;
    },
  };
}
