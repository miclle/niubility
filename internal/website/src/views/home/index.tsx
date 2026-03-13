import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { TextField, SegmentedControl } from '@radix-ui/themes'
import { Search } from 'lucide-react'

import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import Pagination from 'src/components/Pagination'
import type { Content, ContentCategory, ContentType } from 'src/types/content'

// Home displays the content list page, filtered by category from the current path.
function Home() {
  const location = useLocation()
  const category: ContentCategory = location.pathname === '/culture' ? 'culture' : 'learning'

  const [contents, setContents] = useState<Content[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<ContentType | ''>('')
  const [loading, setLoading] = useState(false)
  const limit = 12

  const fetchContents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listContents({
        page,
        limit,
        category,
        type: typeFilter || undefined,
        keyword: keyword || undefined,
      })
      setContents(res.data.contents || [])
      setTotal(res.data.pagination.total)
    } catch {
      setContents([])
    } finally {
      setLoading(false)
    }
  }, [page, category, typeFilter, keyword])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [category, typeFilter, keyword])

  useEffect(() => {
    fetchContents()
  }, [fetchContents])

  return (
    <div className="mesh-gradient min-h-[calc(100vh-8rem)]">
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <TextField.Root
            placeholder="搜索内容..."
            size="2"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-64"
          >
            <TextField.Slot>
              <Search size={16} className="text-zinc-400" />
            </TextField.Slot>
          </TextField.Root>

          <SegmentedControl.Root
            size="2"
            value={typeFilter}
            onValueChange={(val) => setTypeFilter(val as ContentType | '')}
          >
            <SegmentedControl.Item value="">全部</SegmentedControl.Item>
            <SegmentedControl.Item value="article">图文</SegmentedControl.Item>
            <SegmentedControl.Item value="video">视频</SegmentedControl.Item>
          </SegmentedControl.Root>
        </div>

        {/* Content grid */}
        {loading ? (
          <div className="text-center py-20 text-zinc-400">加载中...</div>
        ) : contents.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">暂无内容</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {contents.map((content) => (
              <ContentCard key={content.id} content={content} />
            ))}
          </div>
        )}

        {/* Pagination */}
        <Pagination page={page} limit={limit} total={total} onChange={setPage} />
      </div>
    </div>
  )
}

export default Home
