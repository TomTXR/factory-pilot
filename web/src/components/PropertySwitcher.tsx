import { type Property, propertyLabel } from '../api';

interface Props {
  properties: Property[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function PropertySwitcher({ properties, selectedId, onSelect, onAdd }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="property-switcher" className="label">
          Property
        </label>
        <select
          id="property-switcher"
          className="input"
          value={selectedId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {propertyLabel(p)}
            </option>
          ))}
        </select>
      </div>
      <button type="button" onClick={onAdd} className="btn-secondary">
        Add property
      </button>
    </div>
  );
}
