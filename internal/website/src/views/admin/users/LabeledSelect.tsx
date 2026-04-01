import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// LabeledSelectProps defines the props for the LabeledSelect component.
interface LabeledSelectProps<T extends string> {
  value: T
  labels: Record<T, { label: string; bg: string; color: string }>
  onChange: (val: T) => void
}

// LabeledSelect renders a select dropdown with colored label badges.
function LabeledSelect<T extends string>({ value, labels, onChange }: LabeledSelectProps<T>) {
  const current = labels[value]
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger size="sm" className="w-24 border-0 bg-transparent shadow-none">
        <SelectValue>
          {current
            ? <span className="px-2 py-0.5 rounded text-xs" style={{ background: current.bg, color: current.color }}>{current.label}</span>
            : value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(labels) as [T, { label: string; bg: string; color: string }][]).map(([v, { label, bg, color }]) => (
          <SelectItem key={v} value={v}>
            <span className="px-2 py-0.5 rounded text-xs" style={{ background: bg, color }}>{label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default LabeledSelect
