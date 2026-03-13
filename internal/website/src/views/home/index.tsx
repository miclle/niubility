import { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'

import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import Pagination from 'src/components/Pagination'
import type { Content, ContentCategory, ContentType } from 'src/types/content'

// Outlet context type from MainLayout
interface HomeContext {
  keyword: string
  typeFilter: ContentType | ''
  category: ContentCategory
}

// Home displays the content list page, receiving filters from MainLayout via outlet context.
function Home() {
  const { keyword, typeFilter, category } = useOutletContext<HomeContext>()

  const [contents, setContents] = useState<Content[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
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
    <div className="p-6">
      {/* Content grid - YouTube style responsive grid */}
      {loading ? (
        <div className="text-center py-20" style={{ color: '#606060' }}>
          加载中...
        </div>
      ) : contents.length === 0 ? (
        <div className="text-center py-20" style={{ color: '#606060' }}>
          暂无内容
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          }}
        >
          {contents.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination page={page} limit={limit} total={total} onChange={setPage} />
    </div>
  )
}

export default Home
