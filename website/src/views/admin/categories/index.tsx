import { useState, useEffect, useCallback } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, Save, X, GripVertical, Home, Play, FileText, BookOpen, GraduationCap, Heart, Star, Lightbulb, Trophy, Coffee, Briefcase, Globe, Flame, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { listAllCategories, createCategory, updateCategory, reorderCategories, deleteCategory } from 'src/api/category'
import type { Category } from 'src/types/content'

// iconMap maps icon name strings to Lucide icon components.
const iconMap: Record<string, LucideIcon> = {
  Home, Play, FileText, BookOpen, GraduationCap,
  Heart, Star, Lightbulb, Trophy, Coffee,
  Briefcase, Globe, Flame,
}

// Available icon names for category selection.
const iconOptions = Object.keys(iconMap)

// SortableRow renders a single draggable table row.
function SortableRow({ cat, onEdit, onDelete, onToggleVisible }: {
  cat: Category
  onEdit: (cat: Category) => void
  onDelete: (id: string) => void
  onToggleVisible: (id: string, visible: boolean) => void
}) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderTop: '1px solid var(--surface-border)',
  }

  const Icon = iconMap[cat.icon] || Home

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ padding: '12px 8px 12px 16px', width: 40 }}>
        <button
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-[var(--surface-hover)] transition-colors"
          style={{ color: 'var(--text-tertiary)', touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
      </td>
      <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--foreground)' }}>{cat.name}</td>
      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
        <code className="app-surface-muted px-1.5 py-0.5 rounded text-xs">{cat.slug}</code>
      </td>
      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
        <span className="inline-flex items-center gap-1.5">
          <Icon size={16} />
          <span className="app-text-tertiary text-xs">{cat.icon}</span>
        </span>
      </td>
      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{cat.content_count ?? 0}</td>
      <td style={{ padding: '12px 16px' }}>
        <button
          onClick={() => onToggleVisible(cat.id, !cat.visible)}
          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
          style={{ background: cat.visible ? 'var(--foreground)' : 'color-mix(in srgb, var(--foreground) 20%, transparent)' }}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-full bg-background transition-transform"
            style={{ transform: cat.visible ? 'translateX(18px)' : 'translateX(3px)' }}
          />
        </button>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div className="flex gap-2">
          <Button variant="ghost" style={{ color: 'var(--text-secondary)' }} onClick={() => onEdit(cat)}>
            <Pencil size={14} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger render={
              <Button variant="ghost" style={{ color: '#cc0000' }}>
                <Trash2 size={14} />
              </Button>
            } />
            <AlertDialogContent>
              <AlertDialogTitle>{tc('common:confirm')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin:categoryDeleteConfirm', { name: cat.name })}
              </AlertDialogDescription>
              <div className="flex justify-end gap-3 mt-4">
                <AlertDialogCancel>
                  <Button variant="outline" style={{ borderRadius: '18px' }}>{tc('common:cancel')}</Button>
                </AlertDialogCancel>
                <AlertDialogAction>
                  <Button variant="destructive" onClick={() => onDelete(cat.id)} style={{ borderRadius: '18px' }}>
                    {tc('common:confirm')}
                  </Button>
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  )
}

// AdminCategories displays the admin category management page with drag-and-drop sorting.
function AdminCategories() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [error, setError] = useState('')

  // Form state
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formIcon, setFormIcon] = useState('Home')
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listAllCategories()
      setCategories(res.data.categories || [])
    } catch {
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = categories.findIndex((c) => c.id === active.id)
    const newIndex = categories.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(categories, oldIndex, newIndex)

    // Optimistic update
    setCategories(reordered)

    // Build reorder items with new sort_order values
    const items = reordered.map((cat, i) => ({ id: cat.id, sort_order: i + 1 }))
    try {
      const res = await reorderCategories(items)
      setCategories(res.data.categories || reordered)
    } catch {
      // Revert on failure
      fetchCategories()
    }
  }

  const handleToggleVisible = async (id: string, visible: boolean) => {
    // Optimistic update
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, visible } : c))
    try {
      await updateCategory(id, { visible })
    } catch {
      fetchCategories()
    }
  }

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setFormSlug('')
    setFormIcon('Home')
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setFormName(cat.name)
    setFormSlug(cat.slug)
    setFormIcon(cat.icon || 'Home')
    setError('')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim()) {
      setError(t('admin:categorySaveError'))
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateCategory(editing.id, { name: formName.trim(), icon: formIcon })
      } else {
        await createCategory({ name: formName.trim(), slug: formSlug.trim(), icon: formIcon, sort_order: categories.length + 1 })
      }
      setDialogOpen(false)
      fetchCategories()
    } catch {
      setError(tc('common:saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id)
      fetchCategories()
    } catch (err: any) {
      const msg = err?.response?.data?.meta || err?.response?.data?.error
      alert(typeof msg === 'string' ? msg : t('admin:categoryDeleteError'))
    }
  }

  return (
    <div className="app-surface">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground">{t('admin:categoryManagement')}</h1>
        <Button onClick={openCreate} className="theme-primary-button rounded-[18px]">
          <Plus size={16} />
          {t('admin:newCategory')}
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="app-surface-elevated rounded-xl overflow-hidden border app-border">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--surface-muted)' }}>
                <th style={{ padding: '12px 8px 12px 16px', width: 40 }} />
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('admin:categoryName')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('admin:categorySlug')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('admin:categoryIcon')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('admin:categoryContentCount')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('admin:categoryDisplay')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>{t('admin:categoryActions')}</th>
              </tr>
            </thead>
            <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="app-text-tertiary text-center py-8">{tc('common:loading')}</td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="app-text-tertiary text-center py-8">{t('admin:noCategories')}</td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <SortableRow
                      key={cat.id}
                      cat={cat}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onToggleVisible={handleToggleVisible}
                    />
                  ))
                )}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </DndContext>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t('admin:editCategory') : t('admin:newCategory')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('admin:categoryName')} *</label>
              <Input placeholder={t('admin:categoryNamePlaceholder')} value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <label className="app-text-secondary block text-sm font-medium mb-1.5">
                {t('admin:categorySlug')} *
                {editing && <span className="app-text-tertiary text-xs font-normal ml-2">{t('admin:categorySlugHint')}</span>}
              </label>
              <Input
                placeholder={t('admin:categorySlugPlaceholder')}
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                disabled={!!editing}
              />
            </div>
            <div>
              <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('admin:categoryIcon')}</label>
              <Select value={formIcon} onValueChange={(val) => val && setFormIcon(val)}>
                <SelectTrigger className="w-full">
                  <span className="inline-flex items-center gap-2">
                    {iconMap[formIcon] && (() => { const Icon = iconMap[formIcon]; return <Icon size={16} /> })()}
                    {formIcon}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((name) => {
                    const Icon = iconMap[name]
                    return (
                      <SelectItem key={name} value={name}>
                        <span className="inline-flex items-center gap-2">
                          <Icon size={16} />
                          {name}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
          <DialogFooter>
            <DialogClose render={
              <Button variant="outline">
                <X size={16} />
                {tc('common:cancel')}
              </Button>
            } />
            <Button onClick={handleSave} disabled={saving} className="theme-primary-button">
              <Save size={16} />
              {saving ? tc('common:saving') : t('admin:save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminCategories
