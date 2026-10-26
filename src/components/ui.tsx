import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, type LucideIcon } from 'lucide-react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------
export function Card({ title, subtitle, actions, children, className = '', pad = true, icon: Icon, accent = false }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean
  icon?: LucideIcon; accent?: boolean
}) {
  return (
    <section className={cx('relative overflow-hidden rounded-xl border border-line bg-surface shadow-card', className)}>
      {accent && <div className="accent-bar absolute inset-x-0 top-0 h-1" />}
      {(title || actions) && (
        <header className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5', accent && 'bg-primary-soft/45 pt-4.5')}>
          {Icon && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-ink"><Icon className="size-4" /></span>}
          <div className="mr-auto min-w-0 flex-1">
            {title && <h3 className="text-[15px] font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function Callout({ icon: Icon, tone = 'info', title, children }: {
  icon?: LucideIcon; tone?: 'info' | 'warn' | 'neutral'; title?: ReactNode; children: ReactNode
}) {
  const tones = {
    info: 'bg-primary-soft border-primary/25',
    warn: 'bg-warn-soft border-warn-ink/25 text-warn-ink',
    neutral: 'bg-surface-2 border-line',
  }
  return (
    <div className={cx('flex gap-3 rounded-lg border px-4 py-3 text-[13.5px] leading-relaxed', tones[tone])}>
      {Icon && <Icon className={cx('mt-0.5 size-4 shrink-0', tone === 'info' && 'text-primary')} />}
      <div className="min-w-0">
        {title && <div className="mb-0.5 font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-primary/40 px-6 py-12 text-center" style={{ background: 'radial-gradient(600px 220px at 50% 0, var(--primary-soft), var(--surface) 75%)' }}>
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-ink-2">{children}</div>
    </div>
  )
}

export function Metric({ label, value, sub, color, icon: Icon }: {
  label: string; value: ReactNode; sub?: ReactNode; color?: string; icon?: LucideIcon
}) {
  const c = color ?? 'var(--primary)'
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card"
      style={{ backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${c} 12%, transparent), transparent 60%)` }}>
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: c }} />
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
        {Icon && <span className="grid size-6 place-items-center rounded-md" style={{ background: `color-mix(in oklab, ${c} 18%, transparent)`, color: c }}><Icon className="size-3.5" /></span>}
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[12.5px] text-muted">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
export function Button({ variant = 'secondary', icon: Icon, children, className = '', size = 'md', ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; icon?: LucideIcon; size?: 'sm' | 'md' }) {
  const v = {
    primary: 'bg-primary text-primary-ink hover:bg-primary-hover shadow-card disabled:opacity-45',
    secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong disabled:opacity-50',
    ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  }
  const s = size === 'sm' ? 'h-8 px-3 text-[13px] gap-1.5' : 'h-10 px-4 text-[14px] gap-2'
  return (
    <button {...rest} className={cx('inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed', v[variant], s, className)}>
      {Icon && <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} />}
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label?: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && <div className="text-[13px] font-medium text-ink">{label}</div>}
      {children}
      {hint && <div className="text-[12.5px] leading-snug text-muted">{hint}</div>}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md', full = false }: {
  options: { value: T; label: ReactNode; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void
  size?: 'sm' | 'md'; full?: boolean
}) {
  return (
    <div role="tablist" className={cx('inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-surface-3 p-0.5', full && 'flex w-full')}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)}
            className={cx('inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium transition-all',
              size === 'sm' ? 'min-h-7 px-2.5 py-1 text-[12.5px] leading-tight' : 'min-h-8 px-3 py-1 text-[13px] leading-tight', full && 'flex-1',
              active ? 'bg-surface text-primary shadow-card ring-1 ring-primary/30' : 'text-ink-2 hover:text-ink')}>
            {o.icon && <o.icon className="size-3.5" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function RadioCards<T extends string>({ options, value, onChange, name }: {
  options: { value: T; label: ReactNode; caption?: ReactNode }[]; value: T | null; onChange: (v: T) => void; name: string
}) {
  return (
    <div className="space-y-1.5" role="radiogroup">
      {options.map(o => {
        const active = o.value === value
        return (
          <label key={o.value} className={cx('flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
            active ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-line-strong')}>
            <input type="radio" name={name} className="sr-only" checked={active} onChange={() => onChange(o.value)} />
            <span className={cx('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2',
              active ? 'border-primary' : 'border-line-strong')}>
              {active && <span className="size-1.5 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium leading-tight text-ink">{o.label}</span>
              {o.caption && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{o.caption}</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function Slider({ min, max, step = 1, value, onChange, format = String }: {
  min: number; max: number; step?: number; value: number; onChange: (v: number) => void; format?: (v: number) => string
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex justify-end text-[13px] font-semibold tabular-nums text-primary">{format(value)}</div>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(+e.target.value)} className="relative" />
      </div>
      <div className="mt-0.5 flex justify-between text-[11.5px] text-muted tabular-nums"><span>{format(min)}</span><span>{format(max)}</span></div>
    </div>
  )
}

export function RangeSlider({ min, max, value, onChange, format = String }: {
  min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void; format?: (v: number) => string
}) {
  const [a, b] = value
  const p = (v: number) => ((v - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px] font-semibold tabular-nums text-primary">
        <span>{format(a)}</span><span>{format(b)}</span>
      </div>
      <div className="range-dual relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary" style={{ left: `${p(a)}%`, width: `${p(b) - p(a)}%` }} />
        <input type="range" aria-label="Start" min={min} max={max} value={a} onChange={e => onChange([Math.min(+e.target.value, b - 1), b])} />
        <input type="range" aria-label="End" min={min} max={max} value={b} onChange={e => onChange([a, Math.max(+e.target.value, a + 1)])} />
      </div>
    </div>
  )
}

export function DateInput({ value, min, max, onChange }: { value: string; min: string; max: string; onChange: (v: string) => void }) {
  return (
    <input type="date" value={value} min={min} max={max}
      onChange={e => { if (e.target.value && e.target.value >= min && e.target.value <= max) onChange(e.target.value) }}
      className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink tabular-nums hover:border-line-strong" />
  )
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as T)}
      className="h-10 w-full cursor-pointer rounded-lg border border-line bg-surface px-3 text-[14px] text-ink hover:border-line-strong">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function Toggle({ checked, onChange, label, hint, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean
}) {
  const id = useId()
  return (
    <label htmlFor={id} className={cx('flex items-start gap-3', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <span className="relative mt-0.5 inline-flex">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-surface-3 transition-colors peer-checked:bg-primary" />
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span>
        <span className="block text-[13.5px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{hint}</span>}
      </span>
    </label>
  )
}

export function CheckList({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const on = value.includes(o)
        return (
          <button key={o} onClick={() => onChange(on ? value.filter(x => x !== o) : [...value, o])}
            className={cx('inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-left text-[12.5px] transition-colors',
              on ? 'border-primary bg-primary-soft text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong')}>
            <span className={cx('grid size-3.5 shrink-0 place-items-center rounded-sm border', on ? 'border-primary bg-primary text-primary-ink' : 'border-line-strong')}>
              {on && <Check className="size-2.5" strokeWidth={3} />}
            </span>
            <span className="truncate">{o}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { value: T; label: string; icon?: LucideIcon; badge?: ReactNode }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {tabs.map(t => {
        const active = t.value === value
        return (
          <button key={t.value} role="tab" aria-selected={active} onClick={() => onChange(t.value)}
            className={cx('-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3.5 py-2.5 text-[14px] font-medium transition-colors',
              active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink')}>
            {t.icon && <t.icon className={cx('size-4', active && 'text-primary')} />}
            {t.label}
            {t.badge}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
export interface Column<R> { key: string; label: ReactNode; align?: 'left' | 'right'; render?: (r: R) => ReactNode; className?: string }

export function DataTable<R extends Record<string, unknown>>({ columns, rows, dense = false, highlight }: {
  columns: Column<R>[]; rows: R[]; dense?: boolean; highlight?: (r: R) => boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="bg-primary-soft/55">
            {columns.map(c => (
              <th key={c.key} className={cx('whitespace-nowrap border-b border-line px-3.5 py-2 text-[12.5px] font-semibold text-ink', c.align === 'right' ? 'text-right' : 'text-left')}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cx('border-b border-line last:border-0', highlight?.(r) ? 'bg-primary-soft/60' : 'hover:bg-surface-2/60')}>
              {columns.map(c => (
                <td key={c.key} className={cx('px-3.5', dense ? 'py-1.5' : 'py-2', c.align === 'right' && 'text-right tabular-nums', c.className)}>
                  {c.render ? c.render(r) : String(r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, children, wide = false }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  // Rendered at the end of <body>: an animated (transformed) ancestor would
  // otherwise confine the fixed overlay to its own box.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px] sm:p-8" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        className={cx('animate-in w-full rounded-2xl border border-line bg-surface shadow-pop', wide ? 'max-w-5xl' : 'max-w-2xl')}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
            <X className="size-4.5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3200)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? (
    <div className="animate-in fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-[13.5px] text-bg shadow-pop">{msg}</div>
  ) : null
  return { show: setMsg, node }
}

// ---------------------------------------------------------------------------
// Legend shown above a grid of panels
// ---------------------------------------------------------------------------
export type LegendKind = 'dot' | 'line' | 'dash' | 'band' | 'band-light' | 'rule' | 'window'
export function Legend({ items }: { items: [LegendKind, string, string][] }) {
  const sw = (k: LegendKind, c: string) => {
    switch (k) {
      case 'dot': return <span className="inline-block size-2.5 rounded-full" style={{ background: c }} />
      case 'line': return <span className="inline-block h-0 w-5 border-t-[3px]" style={{ borderColor: c }} />
      case 'dash': return <span className="inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: c }} />
      case 'band': return <span className="inline-block h-3 w-4.5 rounded-sm" style={{ background: c, opacity: 0.45 }} />
      case 'band-light': return <span className="inline-block h-3 w-4.5 rounded-sm" style={{ background: c, opacity: 0.2 }} />
      case 'rule': return <span className="inline-block h-3.5 w-0 border-l-2 border-dashed" style={{ borderColor: c }} />
      case 'window': return <span className="inline-block h-3 w-4.5 rounded-sm" style={{ background: c, opacity: 0.2 }} />
    }
  }
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
      {items.map(([k, c, l]) => (
        <span key={l} className="inline-flex items-center gap-2 text-[13px] text-ink-2">{sw(k, c)}{l}</span>
      ))}
    </div>
  )
}

/** Inline markdown: **bold** only. */
export function Md({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return <>{parts.map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p)}</>
}
