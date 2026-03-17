import { useParams, useNavigate } from 'react-router-dom'

import ContentEditorForm from 'src/components/ContentEditorForm'

// ContentEditor is the admin content editor page.
function ContentEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>
        {isNew ? '新建内容' : '编辑内容'}
      </h1>
      <ContentEditorForm
        id={id}
        submitLabel="保存"
        onSaved={() => navigate('/admin/contents')}
        onCancel={() => navigate('/admin/contents')}
        onLoadError={() => navigate('/admin/contents')}
      />
    </div>
  )
}

export default ContentEditor
