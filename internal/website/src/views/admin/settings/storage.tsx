import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { HardDrive, Shield } from 'lucide-react'

import { MASKED_VALUE, useSettings, useSaveSettings, SettingsLoading, SettingsFeedback, SaveButton } from './shared'

// SettingsStorage provides the S3 storage settings page.
function SettingsStorage() {
  const { loading, settingsMap, reload } = useSettings()
  const { saving, success, error, save } = useSaveSettings(reload)

  const [hasExistingS3Secret, setHasExistingS3Secret] = useState(false)
  const [s3Form, setS3Form] = useState({ endpoint: '', region: '', bucket: '', access_key: '', secret_key: '', public_url: '' })

  useEffect(() => {
    if (loading) return
    const s3 = {
      endpoint: settingsMap['s3.endpoint'] || '',
      region: settingsMap['s3.region'] || '',
      bucket: settingsMap['s3.bucket'] || '',
      access_key: settingsMap['s3.access_key'] || '',
      secret_key: '',
      public_url: settingsMap['s3.public_url'] || '',
    }
    if (settingsMap['s3.secret_key'] === MASKED_VALUE) {
      setHasExistingS3Secret(true)
    } else {
      s3.secret_key = settingsMap['s3.secret_key'] || ''
    }
    setS3Form(s3)
  }, [loading, settingsMap])

  const handleSave = () => {
    const settings: Record<string, string> = {
      's3.endpoint': s3Form.endpoint,
      's3.region': s3Form.region,
      's3.bucket': s3Form.bucket,
      's3.access_key': s3Form.access_key,
      's3.public_url': s3Form.public_url,
    }
    if (s3Form.secret_key || !hasExistingS3Secret) {
      settings['s3.secret_key'] = s3Form.secret_key
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
            <p className="text-xs mt-1" style={{ color: '#909090' }}>CDN 或自定义域名，用于生成文件的公开访问地址</p>
          </div>
        </div>
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
