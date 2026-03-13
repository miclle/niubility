import { Button } from '@radix-ui/themes'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onChange: (page: number) => void
}

// Pagination provides page navigation controls.
function Pagination({ page, limit, total, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      <Button variant="soft" size="2" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} />
        上一页
      </Button>
      <span className="text-sm text-zinc-400 px-3">
        <span className="gradient-text font-semibold">{page}</span> / {totalPages}
      </span>
      <Button variant="soft" size="2" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        下一页
        <ChevronRight size={16} />
      </Button>
    </div>
  )
}

export default Pagination
