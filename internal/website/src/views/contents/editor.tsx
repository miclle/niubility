import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { useAppContext } from 'src/context/app'
import { getContent } from 'src/api/content'
import VideoEditorForm from 'src/components/VideoEditorForm'
import GalleryEditorForm from 'src/components/GalleryEditorForm'
import ArticleEditorForm from 'src/components/ArticleEditorForm'
import type { ContentType, ContentStatus } from 'src/types/content'

// ContentEditor is the user-facing content editor page.
// Routes: /contents/new/video, /contents/new/gallery, /contents/new/article, /contents/:id/edit
function ContentEditor() {
  const { id, type: routeType } = useParams<{ id: string; type: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAppContext()
  const isNew = !id

  const [contentType, setContentType] = useState<ContentType | null>(
    routeType as ContentType || null
  )
  const [loading, setLoading] = useState(false)

  // Sync content type when route param changes (navigating between create types)
  useEffect(() => {
    if (routeType) setContentType(routeType as ContentType)
  }, [routeType])

  // Load content type and verify ownership when editing existing content
  useEffect(() => {
    if (!id || contentType) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        setContentType(res.data.type)
        // Only author can edit their own content (admin can edit any)
        if (currentUser && currentUser.role === 'user' && res.data.author_id !== currentUser.id) {
          navigate('/')
        }
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser) return null
  if (loading) return <div className="text-center py-20" style={{ color: '#909090' }}>加载中...</div>

  const defaultSpeaker = isNew
    ? { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
    : undefined

  const onSaved = (contentId: string, status: ContentStatus) => {
    if (status === 'draft') {
      navigate(`/contents/${contentId}/edit`)
    } else {
      navigate(`/contents/${contentId}`)
    }
  }
  const onCancel = () => navigate(-1)
  const onLoadError = () => navigate('/')

  if (contentType === 'video') {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>
          {isNew ? '发布视频' : '编辑视频'}
        </h1>
        <VideoEditorForm id={id} defaultSpeaker={defaultSpeaker} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
      </div>
    )
  }

  if (contentType === 'gallery') {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>
          {isNew ? '发布图文' : '编辑图文'}
        </h1>
        <GalleryEditorForm id={id} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
      </div>
    )
  }

  if (contentType === 'article') {
    return (
      <div className="max-w-[840px] mx-auto p-6">
        <ArticleEditorForm id={id} defaultSpeaker={defaultSpeaker} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
      </div>
    )
  }

  return null
}

export default ContentEditor
