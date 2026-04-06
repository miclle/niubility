import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { getContent } from 'src/api/content'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import GalleryEditorForm from 'src/components/GalleryEditorForm'
import type { ContentStatus } from 'src/types/content'

// GalleryEditor is the user-facing gallery editor page.
function GalleryEditor() {
  const { t } = useTranslation(['common', 'editor'])
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
        if (res.data.type !== 'gallery') {
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

  const onSaved = (contentId: string, status: ContentStatus) => {
    if (status === 'draft') {
      navigate(contentEditPath({ id: contentId, type: 'gallery' }))
    } else {
      navigate(contentDetailPath({ id: contentId, type: 'gallery' }))
    }
  }
  const onCancel = () => navigate(-1)
  const onLoadError = () => navigate('/')

  return (
    <div className="max-w-[1200px] mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>
        {isNew ? t('editor:publish') + ' ' + t('common:gallery') : t('common:edit') + ' ' + t('common:gallery')}
      </h1>
      <GalleryEditorForm id={id} onSaved={onSaved} onCancel={onCancel} onLoadError={onLoadError} />
    </div>
  )
}

export default GalleryEditor
