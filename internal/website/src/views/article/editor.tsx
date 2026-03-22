import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { useAppContext } from 'src/context/app'
import { getContent } from 'src/api/content'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import ArticleEditorForm from 'src/components/ArticleEditorForm'
import type { ContentStatus } from 'src/types/content'

// ArticleEditor is the user-facing article editor page.
function ArticleEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAppContext()
  const isNew = !id

  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(isNew)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        if (res.data.type !== 'article') {
          navigate(contentEditPath(res.data), { replace: true })
          return
        }
        if (currentUser && currentUser.role === 'user' && res.data.author_id !== currentUser.id) {
          navigate('/')
          return
        }
        setVerified(true)
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser) return null
  if (loading || !verified) return <div className="text-center py-20" style={{ color: '#909090' }}>加载中...</div>

  const defaultSpeaker = isNew
    ? { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
    : undefined

  const onSaved = (contentId: string, status: ContentStatus) => {
    if (status === 'draft') {
      navigate(contentEditPath({ id: contentId, type: 'article' }))
    } else {
      navigate(contentDetailPath({ id: contentId, type: 'article' }))
    }
  }
  const onCancel = () => navigate(-1)
  const onLoadError = () => navigate('/')

  return (
    <div className="max-w-[840px] mx-auto py-6">
      <ArticleEditorForm id={id} defaultSpeaker={defaultSpeaker} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
    </div>
  )
}

export default ArticleEditor
