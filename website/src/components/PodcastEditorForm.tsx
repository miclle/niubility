import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'

import MediaEditorForm, { type MediaEditorConfig, type RenderItemContentProps } from './MediaEditorForm'
import type { ContentStatus } from 'src/types/content'
import type { SearchUserItem } from 'src/types/user'

// PodcastEditorFormProps defines the configurable behavior of the podcast editor form.
export interface PodcastEditorFormProps {
  id?: string
  defaultSpeaker?: SearchUserItem
  onSaved: (contentId: string, status: ContentStatus) => void
  onCancel: () => void
  onLoadError: () => void
}

const podcastConfig: MediaEditorConfig = {
  contentType: 'podcast',
  mediaType: 'audio',
  accept: 'audio/*',
  idPrefix: 'aud',
  uploadLabelKey: 'uploadAudio',
  uploadHintKey: 'uploadAudioHint',
  listLabelKey: 'audioList',
  existsSkippedKey: 'audioExistsSkipped',
  uploadFailedKey: 'audioUploadFailed',
}

// AudioItemContent renders the audio-specific portion: title + description only.
function AudioItemContent({ item, onChange }: RenderItemContentProps) {
  const { t } = useTranslation('editor')

  return (
    <div className="space-y-2">
      <Input placeholder={t('audioTitleOptional')} value={item.title} onChange={(e) => onChange(item.localId, 'title', e.target.value)} />
      <Textarea placeholder={t('audioDescriptionOptional')} value={item.description} onChange={(e) => onChange(item.localId, 'description', e.target.value)} rows={2} />
    </div>
  )
}

// PodcastEditorForm is the editor form for creating/editing podcast content with audio episodes.
function PodcastEditorForm(props: PodcastEditorFormProps) {
  return <MediaEditorForm config={podcastConfig} renderItemContent={AudioItemContent} {...props} />
}

export default PodcastEditorForm
