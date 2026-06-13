import type { PackingDocument, Item } from '@packing/data/types'

interface ItemListProps {
  packing: PackingDocument
  filterPhaseId?: string
  onEdit: (id: string, item: Item) => void
  onAdd?: (categoryId: string) => void
}

export function ItemList({ packing, filterPhaseId, onEdit, onAdd }: ItemListProps) {
  const { categories, features, persons } = packing

  const filteredItems = filterPhaseId
    ? Object.fromEntries(Object.entries(packing.items).filter(([, item]) => {
        if (filterPhaseId === '_unassigned') return !item.phaseId
        return item.phaseId === filterPhaseId
      }))
    : packing.items

  const sortedCategories = Object.entries(categories)
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))

  const uncategorized = Object.entries(filteredItems).filter(([, item]) => !item.categoryId || !categories[item.categoryId])
  const grouped = sortedCategories.map(([catId, cat]) => ({
    catId,
    catName: cat.name,
    items: Object.entries(filteredItems)
      .filter(([, item]) => item.categoryId === catId)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name)),
  }))

  if (Object.keys(filteredItems).length === 0) {
    const msg = filterPhaseId ? 'No items match this phase.' : 'No items yet. Add your first item.'
    return <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>{msg}</p>
  }

  return (
    <div>
      {grouped.map(({ catId, catName, items: catItems }) => (
        catItems.length > 0 && (
          <div key={catId} style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', opacity: 0.7 }}>{catName}</h4>
              {onAdd && (
                <button
                  onClick={() => onAdd(catId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.85rem', padding: '0.125rem 0.25rem', lineHeight: 1 }}
                  title={`Add item to ${catName}`}
                >
                  +
                </button>
              )}
            </div>
            {catItems.map(([id, item]) => (
              <ItemRow key={id} id={id} item={item} features={features} persons={persons} onEdit={onEdit} />
            ))}
          </div>
        )
      ))}
      {uncategorized.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', opacity: 0.7 }}>Uncategorized</h4>
          {uncategorized.sort(([, a], [, b]) => a.name.localeCompare(b.name)).map(([id, item]) => (
            <ItemRow key={id} id={id} item={item} features={features} persons={persons} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  )
}

function ItemRow({ id, item, features, persons, onEdit }: {
  id: string
  item: Item
  features: PackingDocument['features']
  persons: PackingDocument['persons']
  onEdit: (id: string, item: Item) => void
}) {
  const featureTags = item.featureIds.map(fId => features[fId]?.name).filter(Boolean)
  const personTags = item.personIds.map(pId => persons[pId]?.name).filter(Boolean)

  return (
    <div
      onClick={() => onEdit(id, item)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.5rem', borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer', minHeight: '2.75rem',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0, maxWidth: '50%' }}>
        {featureTags.map(tag => (
          <span key={tag} style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.75rem', background: 'var(--bg-secondary)', opacity: 0.7 }}>
            {tag}
          </span>
        ))}
        {personTags.map(tag => (
          <span key={tag} style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', borderRadius: '0.75rem', background: 'var(--bg-secondary)', opacity: 0.7 }}>
            {tag}
          </span>
        ))}
        {item.perPerson && (
          <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>per-person</span>
        )}
      </div>
    </div>
  )
}
