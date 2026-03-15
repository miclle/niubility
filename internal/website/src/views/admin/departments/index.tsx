import { useState, useEffect } from 'react'
import { Building2, Users } from 'lucide-react'

import { listDepartments } from 'src/api/user'
import type { Department } from 'src/types/user'

// AdminDepartments displays the department management page.
function AdminDepartments() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([1])) // root expanded by default

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    setLoading(true)
    try {
      const res = await listDepartments()
      setDepartments(res.data.departments || [])
    } catch {
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }

  // buildTree converts flat list to tree structure
  const buildTree = (items: Department[], parentId: number = 0): DepartmentNode[] => {
    return items
      .filter(item => item.parent_id === parentId)
      .sort((a, b) => a.order - b.order)
      .map(item => ({
        ...item,
        children: buildTree(items, item.id),
      }))
  }

  // toggleExpand expands or collapses a department
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // countChildren recursively counts all children
  const countChildren = (dept: DepartmentNode): number => {
    if (!dept.children || dept.children.length === 0) return 0
    return dept.children.reduce((sum, child) => sum + 1 + countChildren(child), 0)
  }

  // renderDepartment renders a department and its children
  const renderDepartment = (dept: DepartmentNode, level: number = 0) => {
    const hasChildren = dept.children && dept.children.length > 0
    const isExpanded = expandedIds.has(dept.id)
    const childCount = countChildren(dept)

    return (
      <div key={dept.id}>
        <div
          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          style={{ paddingLeft: level * 24 + 12 }}
          onClick={() => hasChildren && toggleExpand(dept.id)}
        >
          {/* Expand/Collapse icon */}
          <span className="w-5 h-5 flex items-center justify-center">
            {hasChildren ? (
              <span
                className="text-xs font-bold transition-transform"
                style={{
                  color: '#909090',
                  display: 'inline-block',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                ▶
              </span>
            ) : (
              <span style={{ color: '#e5e5e5' }}>—</span>
            )}
          </span>

          {/* Department icon */}
          <Building2 size={16} style={{ color: '#606060' }} />

          {/* Department name */}
          <span className="font-medium" style={{ color: '#0f0f0f' }}>
            {dept.name}
          </span>

          {/* English name */}
          {dept.name_en && (
            <span className="text-xs" style={{ color: '#909090' }}>
              {dept.name_en}
            </span>
          )}

          {/* Child count badge */}
          {childCount > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: '#f2f2f2', color: '#606060' }}
            >
              {childCount} 个子部门
            </span>
          )}

          {/* User count */}
          <span
            className="text-xs px-2 py-0.5 rounded ml-auto"
            style={{ background: '#e0f2fe', color: '#0369a1' }}
          >
            {dept.user_count} 人
          </span>

          {/* Department ID */}
          <span className="text-xs" style={{ color: '#909090' }}>
            ID: {dept.id}
          </span>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {dept.children?.map(child => renderDepartment(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // Build tree from flat list
  const tree = buildTree(departments, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>部门管理</h1>
        <div className="text-sm" style={{ color: '#606060' }}>
          共 {departments.length} 个部门
        </div>
      </div>

      {/* Info card */}
      <div
        className="mb-6 p-4 rounded-xl flex items-center gap-3"
        style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}
      >
        <Users size={20} style={{ color: '#606060' }} />
        <span className="text-sm" style={{ color: '#606060' }}>
          部门数据从企业微信同步，点击「微信同步」页面进行同步
        </span>
      </div>

      {/* Department tree */}
      <div className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e5e5' }}>
        {loading ? (
          <div className="text-center py-8" style={{ color: '#909090' }}>
            加载中...
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#909090' }}>
            暂无部门数据，请先同步企业微信
          </div>
        ) : (
          <div>
            {tree.map(dept => renderDepartment(dept))}
          </div>
        )}
      </div>
    </div>
  )
}

// DepartmentNode extends Department with children
interface DepartmentNode extends Department {
  children?: DepartmentNode[]
}

export default AdminDepartments
