import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { getContent } from 'src/api/content'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import PodcastEditorForm from 'src/components/PodcastEditorForm'
import type { ContentStatus } from 'src/types/content'

// PodcastEditor is the user-facing podcast editor page.
function PodcastEditor() {
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
        if (res.data.type !== 'podcast') {
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
  if (loading || !verified) return <div className="text-center py-20" style={{ color: '#909090' }}>{t('common:loading')}</div>

  const defaultSpeaker = isNew
    ? { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
    : undefined

  const onSaved = (contentId: string, status: ContentStatus) => {
    if (status === 'draft') {
      navigate(contentEditPath({ id: contentId, type: 'podcast' }))
    } else {
      navigate(contentDetailPath({ id: contentId, type: 'podcast' }))
    }
  }
  const onCancel = () => navigate(-1)
  const onLoadError = () => navigate('/')

  return (
    <div className="max-w-[1200px] mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>
        {isNew ? t('editor:publish') + ' ' + t('common:podcast') : t('common:edit') + ' ' + t('common:podcast')}
      </h1>
      <PodcastEditorForm id={id} defaultSpeaker={defaultSpeaker} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
    </div>
  )
}

export default PodcastEditor
