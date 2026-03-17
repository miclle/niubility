import { useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'

import { useAppContext } from 'src/context/app'
import ContentEditorForm from 'src/components/ContentEditorForm'

// ContentEditor is the user-facing content editor page.
// Defaults the speaker to the current user when creating new content.
function ContentEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAppContext()
  const isNew = !id

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentUser) {
      window.location.href = '/sso?redirect=' + encodeURIComponent(location.pathname)
    }
  }, [currentUser, location.pathname])

  if (!currentUser) return null

  const defaultSpeaker = isNew
    ? { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
    : undefined

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>
        {isNew ? '创建内容' : '编辑内容'}
      </h1>
      <ContentEditorForm
        id={id}
        defaultSpeaker={defaultSpeaker}
        submitLabel="发布"
        onSaved={(contentId) => navigate(`/contents/${contentId}`)}
        onCancel={() => navigate(-1)}
        onLoadError={() => navigate('/')}
      />
    </div>
  )
}

export default ContentEditor
