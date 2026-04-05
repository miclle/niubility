import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { HardDrive, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { MASKED_VALUE, useSettings, useSaveSettings, SettingsLoading, SettingsFeedback, SaveButton } from './shared'

// SettingsStorage provides the S3 storage settings page.
function SettingsStorage() {
  const { t } = useTranslation('admin')
  const { siteConfig, setSiteConfig } = useAppContext()
  const { loading, settingsMap, reload } = useSettings()
  const storageSave = useSaveSettings(reload)
  const deliverySave = useSaveSettings(reload)
  const imageStyleSave = useSaveSettings(reload)

  const [hasExistingS3Secret, setHasExistingS3Secret] = useState(false)
  const [s3Form, setS3Form] = useState({ endpoint: '', region: '', bucket: '', access_key: '', secret_key: '', public_url: '', cors_origin: '' })
  const [deliveryForm, setDeliveryForm] = useState({ provider: 'disabled', domain: '', private_enabled: 'true', url_ttl_seconds: '3600' })
  const [galleryCardImageStyle, setGalleryCardImageStyle] = useState('')
  const [galleryDetailImageStyle, setGalleryDetailImageStyle] = useState('')
  const [avatarImageStyle, setAvatarImageStyle] = useState('')

  useEffect(() => {
    if (loading) return
    const s3 = {
      endpoint: settingsMap['s3.endpoint'] || '',
      region: settingsMap['s3.region'] || '',
      bucket: settingsMap['s3.bucket'] || '',
      access_key: settingsMap['s3.access_key'] || '',
      secret_key: '',
      public_url: settingsMap['s3.public_url'] || '',
      cors_origin: settingsMap['s3.cors_origin'] || '',
    }
    if (settingsMap['s3.secret_key'] === MASKED_VALUE) {
      setHasExistingS3Secret(true)
    } else {
      s3.secret_key = settingsMap['s3.secret_key'] || ''
    }
    setS3Form(s3)

    const delivery = {
      provider: settingsMap['delivery.provider'] || 'disabled',
      domain: settingsMap['delivery.domain'] || '',
      private_enabled: settingsMap['delivery.private_enabled'] || 'true',
      url_ttl_seconds: settingsMap['delivery.url_ttl_seconds'] || '3600',
    }
    setDeliveryForm(delivery)
    setGalleryCardImageStyle(settingsMap['delivery.gallery_card_image_style'] || settingsMap['site.gallery_card_image_style'] || '')
    setGalleryDetailImageStyle(settingsMap['delivery.gallery_detail_image_style'] || settingsMap['site.gallery_detail_image_style'] || '')
    setAvatarImageStyle(settingsMap['delivery.avatar_image_style'] || settingsMap['site.avatar_image_style'] || '')
  }, [loading, settingsMap])

  const handleSaveStorage = () => {
    const settings: Record<string, string> = {
      's3.endpoint': s3Form.endpoint,
      's3.region': s3Form.region,
      's3.bucket': s3Form.bucket,
      's3.access_key': s3Form.access_key,
      's3.public_url': s3Form.public_url,
      's3.cors_origin': s3Form.cors_origin,
    }
    if (s3Form.secret_key || !hasExistingS3Secret) {
      settings['s3.secret_key'] = s3Form.secret_key
    }
    storageSave.save(settings)
  }

  const handleSaveDelivery = () => {
    deliverySave.save({
      'delivery.provider': deliveryForm.provider,
      'delivery.domain': deliveryForm.domain,
      'delivery.private_enabled': deliveryForm.private_enabled,
      'delivery.url_ttl_seconds': deliveryForm.url_ttl_seconds,
    })
  }

  const handleSaveImageStyles = () => {
    imageStyleSave.save({
      'delivery.gallery_card_image_style': galleryCardImageStyle,
      'delivery.gallery_detail_image_style': galleryDetailImageStyle,
      'delivery.avatar_image_style': avatarImageStyle,
    }).then((saved) => {
      if (!saved) return
      setSiteConfig(siteConfig ? {
        ...siteConfig,
        gallery_card_image_style: galleryCardImageStyle.trim(),
        gallery_detail_image_style: galleryDetailImageStyle.trim(),
        avatar_image_style: avatarImageStyle.trim(),
      } : null)
    })
  }

  if (loading) return <SettingsLoading />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>{t('admin:storageConfig')}</h1>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <HardDrive size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>{t('admin:objectStorageConfig')}</h3>
        </div>

        <SettingsFeedback success={storageSave.success} error={storageSave.error} />

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:serviceEndpoint')}</label>
            <Input
              placeholder={t('admin:serviceEndpointPlaceholder')}
              value={s3Form.endpoint}
              onChange={(e) => setS3Form({ ...s3Form, endpoint: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:serviceEndpointExample')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:storageRegion')}</label>
              <Input
                placeholder={t('admin:storageRegionPlaceholder')}
                value={s3Form.region}
                onChange={(e) => setS3Form({ ...s3Form, region: e.target.value })}
              />
              <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:storageRegionExample')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:storageBucket')}</label>
              <Input
                placeholder={t('admin:storageBucketPlaceholder')}
                value={s3Form.bucket}
                onChange={(e) => setS3Form({ ...s3Form, bucket: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:accessKey')}</label>
            <Input
              placeholder={t('admin:accessKeyPlaceholder')}
              value={s3Form.access_key}
              onChange={(e) => setS3Form({ ...s3Form, access_key: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              {t('admin:secretKey')}
              {hasExistingS3Secret && (
                <span className="ml-2 text-xs" style={{ color: '#166534' }}>{t('admin:secretSetHint')}</span>
              )}
            </label>
            <Input
              type="password"
              placeholder={hasExistingS3Secret ? t('admin:secretKeyPlaceholderSet') : t('admin:secretKeyPlaceholderNew')}
              value={s3Form.secret_key}
              onChange={(e) => setS3Form({ ...s3Form, secret_key: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:publicURL')}</label>
            <Input
              placeholder={t('admin:publicURLPlaceholder')}
              value={s3Form.public_url}
              onChange={(e) => setS3Form({ ...s3Form, public_url: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:publicURLExample')}</p>
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:publicURLHelp')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:corsOrigin')}</label>
            <Textarea
              rows={3}
              placeholder={"http://localhost:9000\nhttps://example.com"}
              value={s3Form.cors_origin}
              onChange={(e) => setS3Form({ ...s3Form, cors_origin: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:corsOriginHelp')}</p>
          </div>
        </div>

        <div className="mt-6">
          <SaveButton saving={storageSave.saving} onClick={handleSaveStorage} />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <HardDrive size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>{t('admin:resourceDistributionConfig')}</h3>
        </div>

        <SettingsFeedback success={deliverySave.success} error={deliverySave.error} />

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:distributionMethod')}</label>
            <Select
              value={deliveryForm.provider}
              onValueChange={(value) => value && setDeliveryForm({ ...deliveryForm, provider: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  <span>{deliveryForm.provider === 'qiniu' ? t('admin:qiniuDistribution') : deliveryForm.provider === 'disabled' ? t('admin:disabledDistribution') : t('admin:selectDistributionMethod')}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">{t('admin:disabledDistribution')}</SelectItem>
                <SelectItem value="qiniu">{t('admin:qiniuDistribution')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:distributionMethodDesc')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:distributionDomain')}</label>
            <Input
              placeholder={t('admin:distributionDomainPlaceholder')}
              value={deliveryForm.domain}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, domain: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:distributionDomainExample')}</p>
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:distributionDomainHelp')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:privateAccess')}</label>
              <Select
                value={deliveryForm.private_enabled}
                onValueChange={(value) => value && setDeliveryForm({ ...deliveryForm, private_enabled: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <span>{deliveryForm.private_enabled === 'true' ? t('admin:enablePrivateAccess') : deliveryForm.private_enabled === 'false' ? t('admin:disablePrivateAccess') : t('admin:selectAccessMethod')}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{t('admin:enablePrivateAccess')}</SelectItem>
                  <SelectItem value="false">{t('admin:disablePrivateAccess')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:privateAccessHelp')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:urlTTLSeconds')}</label>
              <Input
                placeholder={t('admin:urlTTLSecondsPlaceholder')}
                value={deliveryForm.url_ttl_seconds}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, url_ttl_seconds: e.target.value })}
              />
              <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:urlTTLSecondsExample')}</p>
              <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:urlTTLSecondsHelp')}</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs" style={{ color: '#606060' }}>
          {t('admin:privateDistributionNote')}
        </p>

        <div className="mt-6">
          <SaveButton saving={deliverySave.saving} onClick={handleSaveDelivery} />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <HardDrive size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>{t('admin:imageStyles')}</h3>
        </div>

        <SettingsFeedback success={imageStyleSave.success} error={imageStyleSave.error} />

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              {t('admin:galleryCardImageStyle')}
            </label>
            <Input
              placeholder={t('admin:galleryCardImageStylePlaceholder')}
              value={galleryCardImageStyle}
              onChange={(e) => setGalleryCardImageStyle(e.target.value)}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:galleryCardImageStyleExample')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              {t('admin:galleryDetailImageStyle')}
            </label>
            <Input
              placeholder={t('admin:galleryDetailImageStylePlaceholder')}
              value={galleryDetailImageStyle}
              onChange={(e) => setGalleryDetailImageStyle(e.target.value)}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:galleryDetailImageStyleExample')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              {t('admin:avatarImageStyle')}
            </label>
            <Input
              placeholder={t('admin:avatarImageStylePlaceholder')}
              value={avatarImageStyle}
              onChange={(e) => setAvatarImageStyle(e.target.value)}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:avatarImageStyleExample')}</p>
          </div>
        </div>

        <p className="mt-4 text-xs" style={{ color: '#606060' }}>
          {t('admin:imageStyleHelp')}
        </p>

        <div className="mt-6">
          <SaveButton saving={imageStyleSave.saving} onClick={handleSaveImageStyles} />
        </div>
      </div>

      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>{t('admin:secretKeyStorageNote')}</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsStorage
