import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onChange: (page: number) => void
}

// Pagination provides YouTube-style page navigation controls.
function Pagination({ page, limit, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          color: '#0f0f0f',
          background: 'transparent',
          border: '1px solid #e5e5e5',
        }}
      >
        <ChevronLeft size={16} />
        上一页
      </button>
      <span className="text-sm px-3" style={{ color: '#606060' }}>
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          color: '#0f0f0f',
          background: 'transparent',
          border: '1px solid #e5e5e5',
        }}
      >
        下一页
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

export default Pagination
