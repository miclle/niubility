import { useState, useEffect, useRef } from 'react'
import { Search, ChevronRight, ChevronDown, Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Department } from 'src/types/user'

// DepartmentNode extends Department with children for tree structure.
interface DepartmentNode extends Department {
  children?: DepartmentNode[]
}

// buildDepartmentTree converts flat list to tree structure.
function buildDepartmentTree(items: Department[], parentId: number = 0): DepartmentNode[] {
  return items
    .filter(item => item.parent_id === parentId)
    .sort((a, b) => a.order - b.order)
    .map(item => ({
      ...item,
      children: buildDepartmentTree(items, item.id),
    }))
}

// DepartmentFilterProps defines the props for the DepartmentFilter component.
interface DepartmentFilterProps {
  departments: Department[]
  selectedId: string
  onSelect: (id: string) => void
}

// DepartmentFilter renders a searchable dropdown with collapsible tree for departments.
function DepartmentFilter({
  departments,
  selectedId,
  onSelect,
}: DepartmentFilterProps) {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tree = buildDepartmentTree(departments, 0)
  const selectedDept = departments.find(d => String(d.id) === selectedId)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelect = (id: string) => {
    onSelect(id)
    setOpen(false)
  }

  // Flat filtered list for search mode
  const filteredDepts = query.trim()
    ? departments.filter(d => d.name.toLowerCase().includes(query.trim().toLowerCase()) || d.name_en?.toLowerCase().includes(query.trim().toLowerCase()))
    : null

  const renderNode = (node: DepartmentNode, level: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedIds.has(node.id)
    const isSelected = String(node.id) === selectedId

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 py-1.5 px-2 cursor-pointer rounded transition-colors hover:bg-accent"
          style={{ paddingLeft: level * 16 + 8, background: isSelected ? 'var(--color-accent)' : undefined }}
          onClick={() => handleSelect(String(node.id))}
        >
          {hasChildren ? (
            <span className="w-4 h-4 flex items-center justify-center shrink-0" onClick={(e) => toggleExpand(node.id, e)}>
              <ChevronRight size={12} className="app-text-tertiary transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : undefined }} />
            </span>
          ) : (
            <span className="w-4" />
          )}
          <span className={`text-sm flex-1 truncate ${isSelected ? 'text-foreground' : 'app-text-secondary'}`} style={{ fontWeight: isSelected ? 500 : 400 }}>{node.name}</span>
          <span className="app-text-tertiary text-xs tabular-nums">{node.user_count || 0}</span>
        </div>
        {hasChildren && isExpanded && node.children?.map(child => renderNode(child, level + 1))}
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-input bg-transparent px-3 h-8 text-sm whitespace-nowrap transition-colors hover:bg-accent/50"
      >
        <Building2 size={14} className="app-text-secondary" />
        <span className={selectedDept ? 'text-foreground' : 'app-text-secondary'}>{selectedDept ? selectedDept.name : t('admin:allDepartments')}</span>
        <ChevronDown size={14} className="app-text-tertiary" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-lg bg-popover shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
          {/* Search input */}
          <div className="border-b app-border p-2">
            <div className="relative">
              <Search size={14} className="app-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                placeholder={t('admin:searchDept')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
              />
            </div>
          </div>
          {/* Options */}
          <div className="max-h-64 overflow-y-auto py-1 px-1">
            {filteredDepts ? (
              // Search mode: flat list
              filteredDepts.length === 0 ? (
                <div className="app-text-tertiary py-4 text-center text-sm">{t('admin:noMatchedDept')}</div>
              ) : (
                filteredDepts.map(dept => {
                  const isSelected = String(dept.id) === selectedId
                  return (
                    <div
                      key={dept.id}
                      className="flex items-center gap-1.5 py-1.5 px-3 cursor-pointer rounded transition-colors hover:bg-accent"
                      style={{ background: isSelected ? 'var(--color-accent)' : undefined }}
                      onClick={() => handleSelect(String(dept.id))}
                    >
                      <span className={`text-sm flex-1 truncate ${isSelected ? 'text-foreground' : 'app-text-secondary'}`} style={{ fontWeight: isSelected ? 500 : 400 }}>{dept.name}</span>
                      <span className="app-text-tertiary text-xs tabular-nums">{dept.user_count || 0}</span>
                    </div>
                  )
                })
              )
            ) : (
              // Tree mode
              <>
                <div
                  className="flex items-center gap-1.5 py-1.5 px-2 cursor-pointer rounded transition-colors hover:bg-accent"
                  style={{ background: !selectedId ? 'var(--color-accent)' : undefined }}
                  onClick={() => handleSelect('')}
                >
                  <span className="w-4" />
                  <span className={`text-sm flex-1 ${!selectedId ? 'text-foreground' : 'app-text-secondary'}`} style={{ fontWeight: !selectedId ? 500 : 400 }}>{t('admin:allDepartments')}</span>
                </div>
                {tree.map(node => renderNode(node))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DepartmentFilter
