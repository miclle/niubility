import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { getContent } from 'src/api/content'
import VideoEditorForm from 'src/components/VideoEditorForm'
import GalleryEditorForm from 'src/components/GalleryEditorForm'
import ArticleEditorForm from 'src/components/ArticleEditorForm'
import type { ContentType } from 'src/types/content'

// AdminContentEditor is the admin content editor page.
// Routes: /admin/contents/new/video, /admin/contents/new/gallery, /admin/contents/new/article, /admin/contents/:id
function AdminContentEditor() {
  const { id, type: routeType } = useParams<{ id: string; type: string }>()
  const navigate = useNavigate()
  const isNew = !id

  const [contentType, setContentType] = useState<ContentType | null>(
    routeType as ContentType || null
  )
  const [loading, setLoading] = useState(false)

  // Sync content type when route param changes (navigating between create types)
  useEffect(() => {
    if (routeType) setContentType(routeType as ContentType)
  }, [routeType])

  // Load content type when editing existing content
  useEffect(() => {
    if (!id || contentType) return
    setLoading(true)
    getContent(id)
      .then((res) => setContentType(res.data.type))
      .catch(() => navigate('/admin/contents'))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="text-center py-20" style={{ color: '#909090' }}>加载中...</div>

  const onSaved = () => navigate('/admin/contents')
  const onCancel = () => navigate('/admin/contents')
  const onLoadError = () => navigate('/admin/contents')

  const typeLabels: Record<string, string> = { video: '视频', gallery: '图文', article: '长文' }
  const typeLabel = contentType ? typeLabels[contentType] || '' : ''

  if (contentType === 'video') {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>
          {isNew ? '新建视频' : `编辑${typeLabel}`}
        </h1>
        <VideoEditorForm id={id} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
      </div>
    )
  }

  if (contentType === 'gallery') {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>
          {isNew ? '新建图文' : `编辑${typeLabel}`}
        </h1>
        <GalleryEditorForm id={id} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
      </div>
    )
  }

  if (contentType === 'article') {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>
          {isNew ? '新建长文' : `编辑${typeLabel}`}
        </h1>
        <ArticleEditorForm id={id} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
      </div>
    )
  }

  return null
}

export default AdminContentEditor
