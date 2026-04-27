import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ContentStatus } from 'src/types/content'

// EditorActionsProps defines the props for the shared editor action bar.
interface EditorActionsProps {
  saving: boolean
  isNew: boolean
  contentStatus: ContentStatus
  resubmitOnSave?: boolean
  disabled?: boolean
  onSave: (status: ContentStatus) => void
  onCancel: () => void
}

// EditorActions renders the save/draft/publish/cancel action bar used by all editor forms.
// It adapts button labels and visibility based on whether the content is new, draft, or published.
export default function EditorActions({ saving, isNew, contentStatus, resubmitOnSave, disabled, onSave, onCancel }: EditorActionsProps) {
  const { t } = useTranslation('editor')
  return (
    <div className="border-t app-border flex items-center gap-3 pt-4" data-testid="editor-actions">
      {(isNew || contentStatus === 'draft') ? (
        <>
          <Button type="button" variant="outline" disabled={saving || disabled} onClick={() => onSave('draft')}>
            <Save size={16} />
            {saving ? t('saving') : t('saveDraft')}
          </Button>
          <Button type="button" disabled={saving || disabled} onClick={() => onSave('published')} className="theme-primary-button rounded-[18px]">
            {saving ? t('submitting') : t('submitForReview')}
          </Button>
        </>
      ) : (
        <>
          <Button type="button" disabled={saving || disabled} onClick={() => onSave('published')} className="theme-primary-button rounded-[18px]">
            <Save size={16} />
            {saving ? t('saving') : (resubmitOnSave ? t('saveAndResubmit') : t('save'))}
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onSave('draft')}>
            {t('convertToDraft')}
          </Button>
        </>
      )}
      <Button type="button" variant="outline" onClick={onCancel}><X size={16} />{t('cancel')}</Button>
    </div>
  )
}
