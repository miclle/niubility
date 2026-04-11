import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'

import { fileURL } from 'src/api/upload'
import ImageUpload from 'src/components/ImageUpload'
import MediaEditorForm, { type MediaEditorConfig, type RenderItemContentProps } from './MediaEditorForm'
import type { ContentStatus } from 'src/types/content'
import type { SearchUserItem } from 'src/types/user'

// VideoEditorFormProps defines the configurable behavior of the video editor form.
export interface VideoEditorFormProps {
  id?: string
  defaultSpeaker?: SearchUserItem
  onSaved: (contentId: string, status: ContentStatus) => void
  onCancel: () => void
  onLoadError: () => void
}

const videoConfig: MediaEditorConfig = {
  contentType: 'video',
  mediaType: 'video',
  accept: 'video/*',
  idPrefix: 'vid',
  uploadLabelKey: 'uploadVideo',
  uploadHintKey: 'uploadVideoHint',
  listLabelKey: 'videoList',
  existsSkippedKey: 'videoExistsSkipped',
  uploadFailedKey: 'videoUploadFailed',
}

// VideoItemContent renders the video-specific portion: video preview + cover + title/description.
function VideoItemContent({ item, onChange }: RenderItemContentProps) {
  const { t } = useTranslation('editor')

  return (
    <div className="flex gap-4">
      {/* Video preview */}
      <div className="flex-shrink-0">
        <video src={fileURL(item.url)} controls className="w-56 h-32 object-cover rounded" />
      </div>

      {/* Cover image */}
      <div className="flex-shrink-0 w-40">
        <ImageUpload value={item.coverUrl} onChange={(url) => onChange(item.localId, 'coverUrl', url)} placeholder={t('uploadCover')} />
      </div>

      {/* Title and description */}
      <div className="flex-1 space-y-2">
        <Input placeholder={t('videoTitleOptional')} value={item.title} onChange={(e) => onChange(item.localId, 'title', e.target.value)} />
        <Textarea placeholder={t('videoDescriptionOptional')} value={item.description} onChange={(e) => onChange(item.localId, 'description', e.target.value)} rows={3} />
      </div>
    </div>
  )
}

// VideoEditorForm is the editor form for creating/editing video content with playlist.
function VideoEditorForm(props: VideoEditorFormProps) {
  return <MediaEditorForm config={videoConfig} renderItemContent={VideoItemContent} {...props} />
}

export default VideoEditorForm
