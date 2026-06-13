import { BADGE_COLORS, BADGE_COLOR_KEYS } from '@constants'

interface GroupColorPickerProps {
  value: string
  onChange: (colorKey: string) => void
}

export function GroupColorPicker({ value, onChange }: GroupColorPickerProps) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '0.85rem', opacity: 0.7, marginRight: '0.25rem' }}>Color:</span>
      {BADGE_COLOR_KEYS.map((key) => {
        const isSelected = key === value
        const cssVar = BADGE_COLORS[key].cssVar
        return (
          <button
            key={key}
            type="button"
            title={BADGE_COLORS[key].label}
            onClick={() => onChange(key)}
            style={{
              width: '1.4rem',
              height: '1.4rem',
              borderRadius: '50%',
              background: cssVar,
              border: isSelected ? '2px solid var(--text-primary)' : '2px solid transparent',
              cursor: 'pointer',
              padding: 0,
              outline: isSelected ? '2px solid var(--focus-ring)' : 'none',
              outlineOffset: '1px',
              transition: 'outline 0.1s, border-color 0.1s',
            }}
            aria-label={BADGE_COLORS[key].label}
          />
        )
      })}
    </div>
  )
}
