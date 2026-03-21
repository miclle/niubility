import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { Loader2, FileText, Play, Image, Pencil, Heart, MessageSquare, Trash2, Send } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { listContents, updateContent, deleteContent } from 'src/api/content'
import type { Content, ContentStatus } from 'src/types/content'

const limit = 20

// MyContents displays the current user's content list with draft/published tabs and infinite scroll.
function MyContents() {
  const { currentUser } = useAppContext()
  const [contents, setContents] = useState<Content[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<ContentStatus>('published')
  const loaderRef = useRef<HTMLDivElement>(null)
  const hasMore = contents.length < total

  const fetchContents = useCallback(async (p: number, append: boolean, status: ContentStatus) => {
    if (!currentUser) return
    setLoading(true)
    try {
      const res = await listContents({ author_id: currentUser.id, status, page: p, limit })
      const list = res.data.contents || []
      setContents((prev) => append ? [...prev, ...list] : list)
      setTotal(res.data.pagination.total)
    } catch {
      if (!append) setContents([])
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  // Reset and reload when tab changes
  useEffect(() => {
    setContents([])
    setPage(1)
    setTotal(0)
    fetchContents(1, false, activeTab)
  }, [activeTab, fetchContents])

  // Load more when page changes (page > 1)
  useEffect(() => {
    if (page > 1) fetchContents(page, true, activeTab)
  }, [page, fetchContents, activeTab])

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

  const handlePublish = async (content: Content) => {
    try {
      await updateContent(content.id, { status: 'published' })
      setContents((prev) => prev.filter((c) => c.id !== content.id))
      setTotal((t) => t - 1)
    } catch {
      // Silently fail
    }
  }

  const handleDelete = async (content: Content) => {
    if (!confirm('确定要删除这条内容吗？')) return
    try {
      await deleteContent(content.id)
      setContents((prev) => prev.filter((c) => c.id !== content.id))
      setTotal((t) => t - 1)
    } catch {
      // Silently fail
    }
  }

  const typeIcon = (type: string) => {
    if (type === 'video') return <Play size={20} />
    if (type === 'gallery') return <Image size={20} />
    return <FileText size={20} />
  }

  return (
    <div className="mx-auto py-8 px-6" style={{ maxWidth: 960 }}>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>我的内容</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: '#f5f5f5' }}>
        <button
          className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          style={{ background: activeTab === 'published' ? '#ffffff' : 'transparent', color: activeTab === 'published' ? '#0f0f0f' : '#606060', boxShadow: activeTab === 'published' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
          onClick={() => setActiveTab('published')}
        >
          已发布
        </button>
        <button
          className="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          style={{ background: activeTab === 'draft' ? '#ffffff' : 'transparent', color: activeTab === 'draft' ? '#0f0f0f' : '#606060', boxShadow: activeTab === 'draft' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
          onClick={() => setActiveTab('draft')}
        >
          草稿
        </button>
      </div>

      {contents.length === 0 && !loading ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto mb-4" style={{ color: '#d4d4d4' }} />
          <p className="text-sm" style={{ color: '#909090' }}>
            {activeTab === 'draft' ? '暂无草稿' : '暂无发布的内容'}
          </p>
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
                {typeIcon(content.type)}
              </div>

              {/* Title and meta */}
              <div className="flex-1 min-w-0">
                <NavLink
                  to={activeTab === 'draft' ? `/contents/${content.id}/edit` : `/contents/${content.id}`}
                  className="text-sm font-medium no-underline hover:underline truncate block"
                  style={{ color: '#0f0f0f' }}
                >
                  {content.title}
                </NavLink>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs" style={{ color: '#909090' }}>
                    {new Date(content.created_at).toLocaleDateString('zh-CN')}
                  </span>
                  {activeTab === 'published' && (
                    <>
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#909090' }}>
                        <Heart size={12} /> {content.like_count}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#909090' }}>
                        <MessageSquare size={12} /> {content.comment_count}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {activeTab === 'draft' && (
                  <button
                    onClick={() => handlePublish(content)}
                    className="p-1.5 rounded-lg hover:bg-black/10 transition-colors"
                    style={{ color: '#065fd4' }}
                    title="发布"
                  >
                    <Send size={16} />
                  </button>
                )}
                <NavLink
                  to={`/contents/${content.id}/edit`}
                  className="p-1.5 rounded-lg hover:bg-black/10 transition-colors no-underline"
                  style={{ color: '#606060' }}
                  title="编辑"
                >
                  <Pencil size={16} />
                </NavLink>
                <button
                  onClick={() => handleDelete(content)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  style={{ color: '#cc0000' }}
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
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
