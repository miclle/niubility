import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { HardDrive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { useSaveSettings, SettingsFeedback, SaveButton } from './shared'

// ImageStylesCardProps provides the settings map and reload function from the parent.
interface ImageStylesCardProps {
  settingsMap: Record<string, string>
  reload: () => Promise<void>
}

// ImageStylesCard renders the image styles settings card.
function ImageStylesCard({ settingsMap, reload }: ImageStylesCardProps) {
  const { t } = useTranslation('admin')
  const { siteConfig, setSiteConfig } = useAppContext()
  const { saving, success, error, save } = useSaveSettings(reload)

  const [videoCardImageStyle, setVideoCardImageStyle] = useState('')
  const [galleryCardImageStyle, setGalleryCardImageStyle] = useState('')
  const [galleryOriginalImageStyle, setGalleryOriginalImageStyle] = useState('')
  const [galleryDetailImageStyle, setGalleryDetailImageStyle] = useState('')
  const [avatarImageStyle, setAvatarImageStyle] = useState('')

  useEffect(() => {
    setVideoCardImageStyle(settingsMap['delivery.video_card_image_style'] || '')
    setGalleryCardImageStyle(settingsMap['delivery.gallery_card_image_style'] || settingsMap['site.gallery_card_image_style'] || '')
    setGalleryOriginalImageStyle(settingsMap['delivery.gallery_original_image_style'] || '')
    setGalleryDetailImageStyle(settingsMap['delivery.gallery_detail_image_style'] || settingsMap['site.gallery_detail_image_style'] || '')
    setAvatarImageStyle(settingsMap['delivery.avatar_image_style'] || settingsMap['site.avatar_image_style'] || '')
  }, [settingsMap])

  const handleSave = () => {
    save({
      'delivery.video_card_image_style': videoCardImageStyle,
      'delivery.gallery_card_image_style': galleryCardImageStyle,
      'delivery.gallery_original_image_style': galleryOriginalImageStyle,
      'delivery.gallery_detail_image_style': galleryDetailImageStyle,
      'delivery.avatar_image_style': avatarImageStyle,
    }).then((saved) => {
      if (!saved) return
      setSiteConfig(siteConfig ? {
        ...siteConfig,
        video_card_image_style: videoCardImageStyle.trim(),
        gallery_card_image_style: galleryCardImageStyle.trim(),
        gallery_original_image_style: galleryOriginalImageStyle.trim(),
        gallery_detail_image_style: galleryDetailImageStyle.trim(),
        avatar_image_style: avatarImageStyle.trim(),
      } : null)
    })
  }

  return (
    <div className="app-surface-elevated rounded-xl p-6 border app-border">
      <div className="flex items-center gap-2 mb-6">
        <HardDrive size={20} className="text-foreground" />
        <h3 className="font-medium text-foreground">{t('admin:imageStyles')}</h3>
      </div>

      <SettingsFeedback success={success} error={error} />

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">
            {t('admin:videoCardImageStyle')}
          </label>
          <Input
            placeholder={t('admin:videoCardImageStylePlaceholder')}
            value={videoCardImageStyle}
            onChange={(e) => setVideoCardImageStyle(e.target.value)}
          />
          <p className="app-text-tertiary text-xs mt-1">{t('admin:videoCardImageStyleExample')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">
            {t('admin:galleryCardImageStyle')}
          </label>
          <Input
            placeholder={t('admin:galleryCardImageStylePlaceholder')}
            value={galleryCardImageStyle}
            onChange={(e) => setGalleryCardImageStyle(e.target.value)}
          />
          <p className="app-text-tertiary text-xs mt-1">{t('admin:galleryCardImageStyleExample')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">
            {t('admin:galleryOriginalImageStyle')}
          </label>
          <Input
            placeholder={t('admin:galleryOriginalImageStylePlaceholder')}
            value={galleryOriginalImageStyle}
            onChange={(e) => setGalleryOriginalImageStyle(e.target.value)}
          />
          <p className="app-text-tertiary text-xs mt-1">{t('admin:galleryOriginalImageStyleExample')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">
            {t('admin:galleryDetailImageStyle')}
          </label>
          <Input
            placeholder={t('admin:galleryDetailImageStylePlaceholder')}
            value={galleryDetailImageStyle}
            onChange={(e) => setGalleryDetailImageStyle(e.target.value)}
          />
          <p className="app-text-tertiary text-xs mt-1">{t('admin:galleryDetailImageStyleExample')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">
            {t('admin:avatarImageStyle')}
          </label>
          <Input
            placeholder={t('admin:avatarImageStylePlaceholder')}
            value={avatarImageStyle}
            onChange={(e) => setAvatarImageStyle(e.target.value)}
          />
          <p className="app-text-tertiary text-xs mt-1">{t('admin:avatarImageStyleExample')}</p>
        </div>
      </div>

      <p className="app-text-secondary mt-4 text-xs">
        {t('admin:imageStyleHelp')}
      </p>

      <div className="mt-6">
        <SaveButton saving={saving} onClick={handleSave} />
      </div>
    </div>
  )
}

export default ImageStylesCard
