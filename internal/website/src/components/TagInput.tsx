import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// TagInputProps defines the props for the TagInput component.
export interface TagInputProps {
  // Current tags
  tags: string[]
  // Callback when tags change
  onChange: (tags: string[]) => void
  // Optional label text
  label?: string
  // Placeholder for input field
  placeholder?: string
}

// TagInput is a reusable component for entering and managing tags.
export default function TagInput({ tags, onChange, label = '标签', placeholder = '输入标签后按回车或点击添加' }: TagInputProps) {
  const { t } = useTranslation('editor')
  const [tagInput, setTagInput] = useState('')

  const handleAddTag = () => {
    const trimmed = tagInput.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setTagInput('')
      return
    }
    onChange([...tags, trimmed])
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <div>
      {label && (
        <label className="app-text-secondary block text-sm font-medium mb-1.5">{label}</label>
      )}
      <div className="flex items-center gap-2 mb-2">
        <Input
          placeholder={placeholder}
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={handleAddTag}>
          <Plus size={14} />{t('addTag')}
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="app-chip px-2 py-1 rounded-full text-xs cursor-pointer"
              onClick={() => handleRemoveTag(tag)}
            >
              {tag} ×
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
