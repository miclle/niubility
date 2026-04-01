import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'
import type { ContentStatus } from 'src/types/content'

// EditorActionsProps defines the props for the shared editor action bar.
interface EditorActionsProps {
  saving: boolean
  isNew: boolean
  contentStatus: ContentStatus
  disabled?: boolean
  onSave: (status: ContentStatus) => void
  onCancel: () => void
}

// EditorActions renders the save/draft/publish/cancel action bar used by all editor forms.
// It adapts button labels and visibility based on whether the content is new, draft, or published.
export default function EditorActions({ saving, isNew, contentStatus, disabled, onSave, onCancel }: EditorActionsProps) {
  return (
    <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid #e5e5e5' }}>
      {(isNew || contentStatus === 'draft') ? (
        <>
          <Button type="button" variant="outline" disabled={saving || disabled} onClick={() => onSave('draft')}>
            <Save size={16} />
            {saving ? '保存中...' : '保存草稿'}
          </Button>
          <Button type="button" disabled={saving || disabled} onClick={() => onSave('published')} style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}>
            {saving ? '发布中...' : '发布'}
          </Button>
        </>
      ) : (
        <>
          <Button type="button" disabled={saving || disabled} onClick={() => onSave('published')} style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}>
            <Save size={16} />
            {saving ? '保存中...' : '保存'}
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onSave('draft')}>
            转为草稿
          </Button>
        </>
      )}
      <Button type="button" variant="outline" onClick={onCancel}><X size={16} />取消</Button>
    </div>
  )
}
