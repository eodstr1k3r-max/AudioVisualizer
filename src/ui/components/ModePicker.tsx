import { useMemo, useState } from 'react';
import { MODES, MODE_CATEGORY_LABELS, type ModeCategory, type VisualMode } from '../../core/types';
import { useT, translateOrFallback } from '../../core/i18n';

interface ModePickerProps {
  value: VisualMode;
  favorites: VisualMode[];
  onChange: (mode: VisualMode) => void;
  onToggleFavorite: (mode: VisualMode) => void;
}

const CATEGORY_ORDER: ModeCategory[] = ['abstract', 'space', 'nature', 'urban'];

/**
 * Durchsuchbarer Modus-Picker für die 19 Visual-Modi: Textsuche, Favoriten
 * (angepinnt oben), Gruppierung nach Kategorie. Jeder Eintrag ist ein echtes
 * <button> (native Tab-/Enter-/Space-Bedienung), Favoriten-Stern ist separat
 * fokussierbar mit aria-pressed.
 */
export function ModePicker({ value, favorites, onChange, onToggleFavorite }: ModePickerProps) {
  const tr = useT();
  const [query, setQuery] = useState('');

  const items = useMemo(
    () => MODES.map((m) => ({ ...m, label: translateOrFallback(tr, `modes.${m.id}`, m.label) })),
    [tr]
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((m) => m.label.toLowerCase().includes(q) || MODE_CATEGORY_LABELS[m.category].toLowerCase().includes(q))
    : items;

  const favSet = new Set(favorites);
  const favItems = filtered.filter((m) => favSet.has(m.id));
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: filtered.filter((m) => m.category === cat)
  })).filter((g) => g.items.length > 0);

  const renderButton = (m: (typeof items)[number]) => (
    <div className={`mode-cell${value === m.id ? ' active' : ''}`} key={m.id}>
      <button
        type="button"
        className="mode-cell-btn"
        aria-pressed={value === m.id}
        aria-label={`${tr('visuals.mode')}: ${m.label}`}
        onClick={() => onChange(m.id)}
      >
        <span className="mode-cell-icon" aria-hidden="true">{m.icon}</span>
        <span className="mode-cell-label">{m.label}</span>
      </button>
      <button
        type="button"
        className={`mode-fav-btn${favSet.has(m.id) ? ' active' : ''}`}
        aria-pressed={favSet.has(m.id)}
        aria-label={favSet.has(m.id) ? tr('visuals.unfavorite') : tr('visuals.favorite')}
        title={favSet.has(m.id) ? tr('visuals.unfavorite') : tr('visuals.favorite')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(m.id);
        }}
      >
        {favSet.has(m.id) ? '★' : '☆'}
      </button>
    </div>
  );

  return (
    <div className="mode-picker">
      <input
        type="search"
        className="mode-search"
        placeholder={tr('visuals.searchModes')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={tr('visuals.searchModes')}
      />

      {favItems.length > 0 && (
        <div className="mode-group" role="group" aria-label={tr('visuals.favorites')}>
          <div className="mode-group-title">★ {tr('visuals.favorites')}</div>
          <div className="mode-grid">{favItems.map(renderButton)}</div>
        </div>
      )}

      {byCategory.map(({ cat, items: catItems }) => (
        <div className="mode-group" role="group" aria-label={MODE_CATEGORY_LABELS[cat]} key={cat}>
          <div className="mode-group-title">{MODE_CATEGORY_LABELS[cat]}</div>
          <div className="mode-grid">{catItems.map(renderButton)}</div>
        </div>
      ))}

      {filtered.length === 0 && <div className="mode-empty">{tr('visuals.noModesFound')}</div>}
    </div>
  );
}
