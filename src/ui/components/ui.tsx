import type { CSSProperties, ReactNode, KeyboardEvent } from 'react';

/* ------------------------------- Slider -------------------------------- */

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function Slider({ label, value, min, max, step = 0.01, format, onChange, disabled }: SliderProps) {
  // Gefüllter Track: Anteil als CSS-Variable (Progress-Farbe links vom Thumb)
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <label className={`field${disabled ? ' disabled' : ''}`}>
      <span className="field-label">
        <span>{label}</span>
        <strong>{format ? format(value) : value}</strong>
      </span>
      <input
        type="range"
        name={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--fill': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

/* ------------------------------ SelectBox ------------------------------ */

interface SelectOption {
  value: string;
  label: string;
  /** Optional: gruppiert Optionen per <optgroup> (z. B. "Space", "Nature"). Ohne group: flache Liste wie bisher. */
  group?: string;
}

interface SelectBoxProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function SelectBox({ label, value, options, onChange, disabled }: SelectBoxProps) {
  const hasGroups = options.some((o) => o.group);
  let groups: { name: string; items: SelectOption[] }[] = [];
  if (hasGroups) {
    const order: string[] = [];
    const map = new Map<string, SelectOption[]>();
    for (const o of options) {
      const g = o.group ?? '';
      if (!map.has(g)) { map.set(g, []); order.push(g); }
      map.get(g)!.push(o);
    }
    groups = order.map((name) => ({ name, items: map.get(name)! }));
  }

  return (
    <label className={`field${disabled ? ' disabled' : ''}`}>
      <span className="field-label">
        <span>{label}</span>
      </span>
      <select name={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {hasGroups
          ? groups.map((g) =>
              g.name ? (
                <optgroup key={g.name} label={g.name}>
                  {g.items.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              ) : (
                g.items.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))
              )
            )
          : options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
      </select>
    </label>
  );
}

/* -------------------------------- Toggle ------------------------------- */

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className={`toggle${disabled ? ' disabled' : ''}`}>
      <span>{label}</span>
      <input type="checkbox" name={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}

/* ----------------------------- ActionButton ---------------------------- */

interface ActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function ActionButton({ children, onClick, variant = 'primary', disabled, className, title }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`btn ${variant}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

/* ----------------------------- PanelSection ---------------------------- */

export function PanelSection({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return (
    <section className="panel-section">
      <h3>{icon && <span className="ps-icon" aria-hidden="true">{icon}</span>}{title}</h3>
      {children}
    </section>
  );
}

/* --------------------------------- Tabs -------------------------------- */

export interface TabDef {
  id: string;
  label: string;
  icon: string;
}

export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  const onKeyDown = (e: KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(idx + dir + tabs.length) % tabs.length];
    onChange(next.id);
    const btn = document.getElementById(`tab-btn-${next.id}`);
    btn?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label="Panels">
      {tabs.map((t, idx) => (
        <button
          key={t.id}
          id={`tab-btn-${t.id}`}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          aria-controls={`tab-panel-${t.id}`}
          tabIndex={active === t.id ? 0 : -1}
          className={`tab-btn${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKeyDown(e, idx)}
          title={t.label}
        >
          <span className="tab-icon" aria-hidden="true">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
