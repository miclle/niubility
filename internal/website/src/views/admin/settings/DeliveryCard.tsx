import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HardDrive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSaveSettings, SettingsFeedback, SaveButton } from './shared'

// DeliveryCardProps provides the settings map and reload function from the parent.
interface DeliveryCardProps {
  settingsMap: Record<string, string>
  reload: () => Promise<void>
}

// DeliveryCard renders the resource distribution settings card.
function DeliveryCard({ settingsMap, reload }: DeliveryCardProps) {
  const { t } = useTranslation('admin')
  const { saving, success, error, save } = useSaveSettings(reload)

  const [deliveryForm, setDeliveryForm] = useState({ provider: 'disabled', domain: '', private_enabled: 'true', url_ttl_seconds: '3600', style_mode: 'auto' })

  useEffect(() => {
    setDeliveryForm({
      provider: settingsMap['delivery.provider'] || 'disabled',
      domain: settingsMap['delivery.domain'] || '',
      private_enabled: settingsMap['delivery.private_enabled'] || 'true',
      url_ttl_seconds: settingsMap['delivery.url_ttl_seconds'] || '3600',
      style_mode: settingsMap['delivery.style_mode'] || 'auto',
    })
  }, [settingsMap])

  const handleSave = () => {
    save({
      'delivery.provider': deliveryForm.provider,
      'delivery.domain': deliveryForm.domain,
      'delivery.private_enabled': deliveryForm.private_enabled,
      'delivery.url_ttl_seconds': deliveryForm.url_ttl_seconds,
      'delivery.style_mode': deliveryForm.style_mode,
    })
  }

  return (
    <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
      <div className="flex items-center gap-2 mb-6">
        <HardDrive size={20} style={{ color: '#0f0f0f' }} />
        <h3 className="font-medium" style={{ color: '#0f0f0f' }}>{t('admin:resourceDistributionConfig')}</h3>
      </div>

      <SettingsFeedback success={success} error={error} />

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
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:styleMode')}</label>
          <Select
            value={deliveryForm.style_mode}
            onValueChange={(value) => value && setDeliveryForm({ ...deliveryForm, style_mode: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                <span>
                  {deliveryForm.style_mode === 'path_suffix'
                    ? t('admin:styleModePathSuffix')
                    : deliveryForm.style_mode === 'query'
                      ? t('admin:styleModeQuery')
                      : t('admin:styleModeAuto')}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('admin:styleModeAuto')}</SelectItem>
              <SelectItem value="query">{t('admin:styleModeQuery')}</SelectItem>
              <SelectItem value="path_suffix">{t('admin:styleModePathSuffix')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:styleModeHelp')}</p>
        </div>
      </div>
      <p className="mt-4 text-xs" style={{ color: '#606060' }}>
        {t('admin:privateDistributionNote')}
      </p>

      <div className="mt-6">
        <SaveButton saving={saving} onClick={handleSave} />
      </div>
    </div>
  )
}

export default DeliveryCard
