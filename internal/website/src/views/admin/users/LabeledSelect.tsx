import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// LabeledSelectProps defines the props for the LabeledSelect component.
interface LabeledSelectProps<T extends string> {
  value: T
  // colors: maps values to { bg, color } styles (no labels)
  colors: Record<T, { bg: string; color: string }>
  // labelKey: translation key function that takes a value and returns a translated label
  labelKey: (value: T) => string
  onChange: (val: T) => void
}

// LabeledSelect renders a select dropdown with colored label badges.
function LabeledSelect<T extends string>({ value, colors, labelKey, onChange }: LabeledSelectProps<T>) {
  const current = colors[value]
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger size="sm" className="w-24 border-0 bg-transparent shadow-none">
        <SelectValue>
          {current
            ? <span className="px-2 py-0.5 rounded text-xs" style={{ background: current.bg, color: current.color }}>{labelKey(value)}</span>
            : value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(colors) as [T, { bg: string; color: string }][]).map(([v, { bg, color }]) => (
          <SelectItem key={v} value={v}>
            <span className="px-2 py-0.5 rounded text-xs" style={{ background: bg, color }}>{labelKey(v)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default LabeledSelect
