import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { HardDrive, Shield } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { MASKED_VALUE, useSettings, useSaveSettings, SettingsLoading, SettingsFeedback, SaveButton } from './shared'

const deliveryProviderLabels: Record<string, string> = {
  disabled: '关闭分发签名',
  qiniu: '七牛云私有分发',
}

const privateAccessLabels: Record<string, string> = {
  true: '开启签名访问',
  false: '关闭签名访问',
}

// SettingsStorage provides the S3 storage settings page.
function SettingsStorage() {
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
      <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>存储配置</h1>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <HardDrive size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>对象存储配置（S3 兼容）</h3>
        </div>

        <SettingsFeedback success={storageSave.success} error={storageSave.error} />

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>服务地址（Endpoint）</label>
            <Input
              placeholder="请输入对象存储服务地址"
              value={s3Form.endpoint}
              onChange={(e) => setS3Form({ ...s3Form, endpoint: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>示例：https://s3.amazonaws.com</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>区域（Region）</label>
              <Input
                placeholder="请输入存储区域"
                value={s3Form.region}
                onChange={(e) => setS3Form({ ...s3Form, region: e.target.value })}
              />
              <p className="text-xs mt-1" style={{ color: '#909090' }}>示例：cn-east-1</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>存储桶（Bucket）</label>
              <Input
                placeholder="请输入存储桶名称"
                value={s3Form.bucket}
                onChange={(e) => setS3Form({ ...s3Form, bucket: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>访问密钥（Access Key）</label>
            <Input
              placeholder="请输入访问密钥"
              value={s3Form.access_key}
              onChange={(e) => setS3Form({ ...s3Form, access_key: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              访问密钥口令（Secret Key）
              {hasExistingS3Secret && (
                <span className="ml-2 text-xs" style={{ color: '#166534' }}>(已设置，留空保持不变)</span>
              )}
            </label>
            <Input
              type="password"
              placeholder={hasExistingS3Secret ? '留空保持现有密钥不变' : '请输入访问密钥口令'}
              value={s3Form.secret_key}
              onChange={(e) => setS3Form({ ...s3Form, secret_key: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>公开访问地址（可选）</label>
            <Input
              placeholder="请输入公开访问地址"
              value={s3Form.public_url}
              onChange={(e) => setS3Form({ ...s3Form, public_url: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>示例：https://cdn.example.com</p>
            <p className="text-xs mt-1" style={{ color: '#909090' }}>仅用于公开访问模式。若启用了下方的私有分发配置，系统会优先使用分发域名而不是这里。</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>跨域来源（CORS，可选）</label>
            <Textarea
              rows={3}
              placeholder={"http://localhost:9000\nhttps://example.com"}
              value={s3Form.cors_origin}
              onChange={(e) => setS3Form({ ...s3Form, cors_origin: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>允许浏览器跨域上传的来源地址，每行一个，保存时会自动配置 S3 存储桶 CORS 规则</p>
          </div>
        </div>

        <div className="mt-6">
          <SaveButton saving={storageSave.saving} onClick={handleSaveStorage} />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <HardDrive size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>资源分发配置</h3>
        </div>

        <SettingsFeedback success={deliverySave.success} error={deliverySave.error} />

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>分发方式</label>
            <Select
              value={deliveryForm.provider}
              onValueChange={(value) => value && setDeliveryForm({ ...deliveryForm, provider: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  <span>{deliveryProviderLabels[deliveryForm.provider] || '请选择分发方式'}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">关闭分发签名</SelectItem>
                <SelectItem value="qiniu">七牛云私有分发</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs mt-1" style={{ color: '#909090' }}>当前第一阶段支持“关闭分发签名”和“七牛云私有分发”。七牛云模式会复用上方的访问密钥与访问密钥口令，为分发域名生成私有样式访问 URL。</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>分发域名</label>
            <Input
              placeholder="请输入分发域名"
              value={deliveryForm.domain}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, domain: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>示例：https://img.example.com</p>
            <p className="text-xs mt-1" style={{ color: '#909090' }}>对外访问资源的分发域名。私有分发与图片样式都通过这个域名生效。</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>私有访问</label>
              <Select
                value={deliveryForm.private_enabled}
                onValueChange={(value) => value && setDeliveryForm({ ...deliveryForm, private_enabled: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <span>{privateAccessLabels[deliveryForm.private_enabled] || '请选择访问方式'}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">开启签名访问</SelectItem>
                  <SelectItem value="false">关闭签名访问</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs mt-1" style={{ color: '#909090' }}>启用后会为最终分发 URL 追加访问时效与签名。</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>链接有效期（秒）</label>
              <Input
                placeholder="请输入链接有效期"
                value={deliveryForm.url_ttl_seconds}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, url_ttl_seconds: e.target.value })}
              />
              <p className="text-xs mt-1" style={{ color: '#909090' }}>示例：3600</p>
              <p className="text-xs mt-1" style={{ color: '#909090' }}>私有分发链接有效期，单位秒。</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs" style={{ color: '#606060' }}>
          若要在私有对象场景下继续使用图片样式，请配置 qiniu 分发域名，并保持 bucket 为私有。系统会复用上方配置的 Access Key / Secret Key，对最终分发 URL 进行签名；前端访问到的是已签名的分发 URL，而不是 S3 的 X-Amz 临时下载地址。
        </p>

        <div className="mt-6">
          <SaveButton saving={deliverySave.saving} onClick={handleSaveDelivery} />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <HardDrive size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>图片样式</h3>
        </div>

        <SettingsFeedback success={imageStyleSave.success} error={imageStyleSave.error} />

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              图集封面卡片样式
            </label>
            <Input
              placeholder="请输入图集封面卡片样式"
              value={galleryCardImageStyle}
              onChange={(e) => setGalleryCardImageStyle(e.target.value)}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>示例：imageView2/1/w/720/h/405</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              图集详情页图片样式
            </label>
            <Input
              placeholder="请输入图集详情页图片样式"
              value={galleryDetailImageStyle}
              onChange={(e) => setGalleryDetailImageStyle(e.target.value)}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>示例：imageView2/2/w/960</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              头像样式
            </label>
            <Input
              placeholder="请输入头像样式"
              value={avatarImageStyle}
              onChange={(e) => setAvatarImageStyle(e.target.value)}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>示例：imageView2/1/w/160/h/160</p>
          </div>
        </div>

        <p className="mt-4 text-xs" style={{ color: '#606060' }}>
          这里填写的是原样附加到图片 URL 后的查询片段，不需要包含 `?`。建议与上方的分发域名、私有访问策略配套配置。
        </p>

        <div className="mt-6">
          <SaveButton saving={imageStyleSave.saving} onClick={handleSaveImageStyles} />
        </div>
      </div>

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
