import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { getContent } from 'src/api/content'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import VideoEditorForm from 'src/components/VideoEditorForm'
import type { ContentStatus } from 'src/types/content'

// VideoEditor is the user-facing video editor page.
function VideoEditor() {
  const { t } = useTranslation(['common', 'editor'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAppContext()
  const isNew = !id

  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(isNew)

  // Load and verify content type and ownership when editing
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        // Redirect to correct editor if type doesn't match
        if (res.data.type !== 'video') {
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
  if (loading || !verified) return <div className="app-text-tertiary text-center py-20">{t('common:loading')}</div>

  const defaultSpeaker = isNew
    ? { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
    : undefined

  const onSaved = (contentId: string, status: ContentStatus) => {
    if (status === 'draft') {
      navigate(contentEditPath({ id: contentId, type: 'video' }))
    } else {
      navigate(contentDetailPath({ id: contentId, type: 'video' }))
    }
  }
  const onCancel = () => navigate(-1)
  const onLoadError = () => navigate('/')

  return (
    <div className="max-w-[1200px] mx-auto p-6">
      <h1 className="text-xl font-semibold text-foreground mb-6">
        {isNew ? t('editor:publish') + ' ' + t('common:video') : t('common:edit') + ' ' + t('common:video')}
      </h1>
      <VideoEditorForm id={id} defaultSpeaker={defaultSpeaker} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
    </div>
  )
}

export default VideoEditor
