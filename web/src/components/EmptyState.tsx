export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No properties yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-slate-600">
        Add a property to start keeping track of its maintenance and costs.
      </p>
      <button type="button" onClick={onAdd} className="btn-primary mt-6">
        Add your first property
      </button>
    </section>
  );
}
