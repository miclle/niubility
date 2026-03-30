import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HardDrive, Shield } from 'lucide-react'

import { MASKED_VALUE, useSettings, useSaveSettings, SettingsLoading, SettingsFeedback, SaveButton } from './shared'

// SettingsStorage provides the S3 storage settings page.
function SettingsStorage() {
  const { loading, settingsMap, reload } = useSettings()
  const { saving, success, error, save } = useSaveSettings(reload)

  const [hasExistingS3Secret, setHasExistingS3Secret] = useState(false)
  const [hasExistingDeliverySignSecret, setHasExistingDeliverySignSecret] = useState(false)
  const [s3Form, setS3Form] = useState({ endpoint: '', region: '', bucket: '', access_key: '', secret_key: '', public_url: '', cors_origin: '' })
  const [deliveryForm, setDeliveryForm] = useState({ provider: 'disabled', domain: '', private_enabled: 'true', url_ttl_seconds: '3600', sign_key: '', sign_secret: '' })

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
      sign_key: settingsMap['delivery.sign_key'] || '',
      sign_secret: '',
    }
    if (settingsMap['delivery.sign_secret'] === MASKED_VALUE) {
      setHasExistingDeliverySignSecret(true)
    } else {
      delivery.sign_secret = settingsMap['delivery.sign_secret'] || ''
    }
    setDeliveryForm(delivery)
  }, [loading, settingsMap])

  const handleSave = () => {
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
    settings['delivery.provider'] = deliveryForm.provider
    settings['delivery.domain'] = deliveryForm.domain
    settings['delivery.private_enabled'] = deliveryForm.private_enabled
    settings['delivery.url_ttl_seconds'] = deliveryForm.url_ttl_seconds
    settings['delivery.sign_key'] = deliveryForm.sign_key
    if (deliveryForm.sign_secret || !hasExistingDeliverySignSecret) {
      settings['delivery.sign_secret'] = deliveryForm.sign_secret
    }
    save(settings)
  }

  if (loading) return <SettingsLoading />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>存储配置</h1>

      <SettingsFeedback success={success} error={error} />

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <HardDrive size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>存储配置 (S3)</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Endpoint</label>
            <Input
              placeholder="https://s3.amazonaws.com"
              value={s3Form.endpoint}
              onChange={(e) => setS3Form({ ...s3Form, endpoint: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Region</label>
              <Input
                placeholder="us-east-1"
                value={s3Form.region}
                onChange={(e) => setS3Form({ ...s3Form, region: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Bucket</label>
              <Input
                placeholder="my-bucket"
                value={s3Form.bucket}
                onChange={(e) => setS3Form({ ...s3Form, bucket: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Access Key</label>
            <Input
              placeholder="请输入 Access Key"
              value={s3Form.access_key}
              onChange={(e) => setS3Form({ ...s3Form, access_key: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              Secret Key
              {hasExistingS3Secret && (
                <span className="ml-2 text-xs" style={{ color: '#166534' }}>(已设置，留空保持不变)</span>
              )}
            </label>
            <Input
              type="password"
              placeholder={hasExistingS3Secret ? '留空保持现有密钥不变' : '请输入 Secret Key'}
              value={s3Form.secret_key}
              onChange={(e) => setS3Form({ ...s3Form, secret_key: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Public URL (可选)</label>
            <Input
              placeholder="https://cdn.example.com（留空则使用 Endpoint 拼接）"
              value={s3Form.public_url}
              onChange={(e) => setS3Form({ ...s3Form, public_url: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>仅用于公开访问模式。若启用了下方的私有分发配置，系统会优先使用分发域名而不是这里。</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>CORS Origin (可选)</label>
            <Textarea
              rows={3}
              placeholder={"http://localhost:9000\nhttps://example.com"}
              value={s3Form.cors_origin}
              onChange={(e) => setS3Form({ ...s3Form, cors_origin: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>允许浏览器跨域上传的来源地址，每行一个，保存时会自动配置 S3 存储桶 CORS 规则</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <HardDrive size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>资源分发配置</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Delivery Provider</label>
            <Input
              placeholder="disabled / qiniu"
              value={deliveryForm.provider}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, provider: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>当前第一阶段支持 disabled 和 qiniu。qiniu 模式会使用分发域名生成私有样式访问 URL。</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Delivery Domain</label>
            <Input
              placeholder="https://img.example.com"
              value={deliveryForm.domain}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, domain: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>对外访问资源的分发域名。私有分发与图片样式都通过这个域名生效。</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Private Enabled</label>
              <Input
                placeholder="true"
                value={deliveryForm.private_enabled}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, private_enabled: e.target.value })}
              />
              <p className="text-xs mt-1" style={{ color: '#909090' }}>启用后会为最终分发 URL 追加访问时效与签名。</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>URL TTL Seconds</label>
              <Input
                placeholder="3600"
                value={deliveryForm.url_ttl_seconds}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, url_ttl_seconds: e.target.value })}
              />
              <p className="text-xs mt-1" style={{ color: '#909090' }}>私有分发链接有效期，单位秒。</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Sign Key</label>
            <Input
              placeholder="请输入七牛 AccessKey"
              value={deliveryForm.sign_key}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, sign_key: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              Sign Secret
              {hasExistingDeliverySignSecret && (
                <span className="ml-2 text-xs" style={{ color: '#166534' }}>(已设置，留空保持不变)</span>
              )}
            </label>
            <Input
              type="password"
              placeholder={hasExistingDeliverySignSecret ? '留空保持现有密钥不变' : '请输入七牛 SecretKey'}
              value={deliveryForm.sign_secret}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, sign_secret: e.target.value })}
            />
          </div>
        </div>
        <p className="mt-4 text-xs" style={{ color: '#606060' }}>
          若要在私有对象场景下继续使用图片样式，请配置 qiniu 分发域名与签名信息，并保持 bucket 为私有。前端访问到的是已签名的分发 URL，而不是 S3 的 X-Amz 临时下载地址。
        </p>
      </div>

      <SaveButton saving={saving} onClick={handleSave} />

      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>敏感信息（如 Secret Key）使用 AES-256-GCM 加密存储</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsStorage
