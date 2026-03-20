import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { Loader2, FileText, Play, Pencil, Heart, MessageSquare } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { listContents } from 'src/api/content'
import type { Content } from 'src/types/content'

const limit = 20

// MyContents displays the current user's published content list with infinite scroll.
function MyContents() {
  const { currentUser } = useAppContext()
  const [contents, setContents] = useState<Content[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)
  const hasMore = contents.length < total

  const fetchContents = useCallback(async (p: number, append: boolean) => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await listContents({ author_id: currentUser.id, page: p, limit })
      const list = res.data.contents || []
      setContents((prev) => append ? [...prev, ...list] : list)
      setTotal(res.data.pagination.total)
    } catch {
      if (!append) setContents([])
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  // Initial load
  useEffect(() => {
    fetchContents(1, false)
  }, [fetchContents])

  // Load more when page changes (page > 1)
  useEffect(() => {
    if (page > 1) fetchContents(page, true)
  }, [page, fetchContents])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          setPage((p) => p + 1)
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, hasMore])

  return (
    <div className="mx-auto py-8 px-6" style={{ maxWidth: 960 }}>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>我的内容</h1>

      {contents.length === 0 && !loading ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto mb-4" style={{ color: '#d4d4d4' }} />
          <p className="text-sm" style={{ color: '#909090' }}>暂无发布的内容</p>
        </div>
      ) : (
        <div className="space-y-1">
          {contents.map((content) => (
            <div
              key={content.id}
              className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-black/5 transition-colors"
            >
              {/* Type icon */}
              <div className="flex-shrink-0" style={{ color: '#909090' }}>
                {content.type === 'video' ? <Play size={20} /> : <FileText size={20} />}
              </div>

              {/* Title and meta */}
              <div className="flex-1 min-w-0">
                <NavLink
                  to={`/contents/${content.id}`}
                  className="text-sm font-medium no-underline hover:underline truncate block"
                  style={{ color: '#0f0f0f' }}
                >
                  {content.title}
                </NavLink>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs" style={{ color: '#909090' }}>
                    {new Date(content.created_at).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#909090' }}>
                    <Heart size={12} /> {content.like_count}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#909090' }}>
                    <MessageSquare size={12} /> {content.comment_count}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <NavLink
                  to={`/contents/${content.id}/edit`}
                  className="p-1.5 rounded-lg hover:bg-black/10 transition-colors no-underline"
                  style={{ color: '#606060' }}
                  title="编辑"
                >
                  <Pencil size={16} />
                </NavLink>
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={loaderRef} className="py-4 text-center text-sm" style={{ color: '#909090' }}>
        {loading ? '加载中...' : hasMore ? '' : contents.length > 0 ? '没有更多了' : ''}
      </div>
    </div>
  )
}

export default MyContents
