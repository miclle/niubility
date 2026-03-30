import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Globe2, Upload, Shield } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { useSettings, useSaveSettings, SettingsLoading, SaveButton } from './shared'
import { uploadSiteResource } from 'src/api/upload'
import { siteResourceURL } from 'src/api/upload'
import type { SiteConfig } from 'src/types/user'

// SettingsSite provides the site configuration settings page.
function SettingsSite() {
    const { siteConfig, setSiteConfig } = useAppContext()
    const { loading, settingsMap, reload } = useSettings()
    const { saving, save } = useSaveSettings(reload)

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [keywords, setKeywords] = useState('')
    const [version, setVersion] = useState('')
    const [faviconURL, setFaviconURL] = useState('')
    const [logoURL, setLogoURL] = useState('')
    const [copyright, setCopyright] = useState('')
    const [forceHTTPS, setForceHTTPS] = useState(false)
    const [footer, setFooter] = useState('')
    const [videoDefaultCoverURL, setVideoDefaultCoverURL] = useState('')
    const [videoSpeakerDefaultAvatarURL, setVideoSpeakerDefaultAvatarURL] = useState('')
    const [uploading, setUploading] = useState(false)

    // Load settings from API
    useEffect(() => {
        if (settingsMap) {
            setTitle(settingsMap['site.title'] || '')
            setDescription(settingsMap['site.description'] || '')
            setKeywords(settingsMap['site.keywords'] || '')
            setVersion(settingsMap['site.version'] || '')
            setFaviconURL(settingsMap['site.favicon_url'] || '')
            setLogoURL(settingsMap['site.logo_url'] || '')
            setCopyright(settingsMap['site.copyright'] || '')
            setForceHTTPS(settingsMap['site.force_https'] === 'true')
            setFooter(settingsMap['site.footer'] || '')
            setVideoDefaultCoverURL(settingsMap['site.video_default_cover_url'] || '')
            setVideoSpeakerDefaultAvatarURL(settingsMap['site.video_speaker_default_avatar_url'] || '')
        }
    }, [settingsMap])

    // Handle favicon upload
    const handleUploadFavicon = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const key = await uploadSiteResource(file)
            setFaviconURL(key)
        } catch (err) {
            console.error('Upload favicon failed:', err)
        } finally {
            setUploading(false)
        }
    }

    // Handle logo upload
    const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const key = await uploadSiteResource(file)
            setLogoURL(key)
        } catch (err) {
            console.error('Upload logo failed:', err)
        } finally {
            setUploading(false)
        }
    }

    const handleUploadContentAsset = async (
        e: React.ChangeEvent<HTMLInputElement>,
        setter: (value: string) => void,
    ) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const key = await uploadSiteResource(file)
            setter(key)
        } catch (err) {
            console.error('Upload content asset failed:', err)
        } finally {
            setUploading(false)
        }
    }

    const buildSiteConfig = (): SiteConfig => ({
        title: title.trim() || 'Niubility',
        description: description.trim(),
        keywords: keywords.trim(),
        version: version.trim(),
        favicon_url: faviconURL.trim(),
        logo_url: logoURL.trim(),
        copyright: copyright.trim() || 'Niubility',
        force_https: forceHTTPS,
        footer: footer,
        video_default_cover_url: videoDefaultCoverURL.trim(),
        video_speaker_default_avatar_url: videoSpeakerDefaultAvatarURL.trim(),
        gallery_card_image_style: siteConfig?.gallery_card_image_style?.trim() || '',
        gallery_detail_image_style: siteConfig?.gallery_detail_image_style?.trim() || '',
        avatar_image_style: siteConfig?.avatar_image_style?.trim() || '',
    })

    // Handle save settings
    const handleSave = async () => {
        const nextConfig = buildSiteConfig()
        const saved = await save({
            'site.title': title,
            'site.description': description,
            'site.keywords': keywords,
            'site.version': version,
            'site.favicon_url': faviconURL,
            'site.logo_url': logoURL,
            'site.copyright': copyright,
            'site.force_https': forceHTTPS ? 'true' : 'false',
            'site.footer': footer,
            'site.video_default_cover_url': videoDefaultCoverURL,
            'site.video_speaker_default_avatar_url': videoSpeakerDefaultAvatarURL,
        })
        if (saved) {
            setSiteConfig(nextConfig)
        }
    }

    if (loading) {
        return <SettingsLoading />
    }

    return (
        <div className="max-w-4xl space-y-6">
            {/* Basic Settings */}
            <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
                <div className="flex items-center gap-2 mb-6">
                    <Globe2 size={20} style={{ color: '#0f0f0f' }} />
                    <h3 className="font-medium" style={{ color: '#0f0f0f' }}>基本设置</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                            网站名称
                        </label>
                        <Input
                            placeholder="Niubility"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                            网站描述
                        </label>
                        <Input
                            placeholder="企业内部学习与文化平台"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                            网站关键词
                        </label>
                        <Input
                            placeholder="学习,文化,视频,平台"
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                            版本标识
                        </label>
                        <Input
                            placeholder="例如 v2.3.1 / 2026 Spring"
                            value={version}
                            onChange={(e) => setVersion(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                                Favicon
                            </label>
                            <div className="flex items-center gap-3">
                                {faviconURL && (
                                    <img src={siteResourceURL(faviconURL)} alt="Favicon" className="w-6 h-6 object-contain rounded" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('favicon-upload')?.click()}
                                    className="px-2 rounded-lg hover:bg-black/5 transition-colors"
                                    style={{ border: '1px solid #e5e5e5', color: '#0f0f0f' }}
                                    disabled={uploading}
                                >
                                    <Upload size={16} />
                                </button>
                                <input
                                    id="favicon-upload"
                                    type="file"
                                    accept="image/*,.ico,.png,.svg"
                                    className="hidden"
                                    onChange={handleUploadFavicon}
                                />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                                Logo
                            </label>
                            <div className="flex items-center gap-3">
                                {logoURL && (
                                    <img src={siteResourceURL(logoURL)} alt="Logo" className="h-6 w-6 object-contain rounded" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('logo-upload')?.click()}
                                    className="px-2 rounded-lg hover:bg-black/5 transition-colors"
                                    style={{ border: '1px solid #e5e5e5', color: '#0f0f0f' }}
                                    disabled={uploading}
                                >
                                    <Upload size={16} />
                                </button>
                                <input
                                    id="logo-upload"
                                    type="file"
                                    accept="image/*,.ico,.png,.svg"
                                    className="hidden"
                                    onChange={handleUploadLogo}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
                <div className="flex items-center gap-2 mb-6">
                    <h3 className="font-medium" style={{ color: '#0f0f0f' }}>内容默认图</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                            视频默认封面
                        </label>
                        <div className="flex items-center gap-3">
                            {videoDefaultCoverURL && (
                                <img src={siteResourceURL(videoDefaultCoverURL)} alt="视频默认封面" className="h-10 w-16 rounded object-cover" />
                            )}
                            <button
                                type="button"
                                onClick={() => document.getElementById('video-default-cover-upload')?.click()}
                                className="px-2 rounded-lg hover:bg-black/5 transition-colors"
                                style={{ border: '1px solid #e5e5e5', color: '#0f0f0f' }}
                                disabled={uploading}
                            >
                                <Upload size={16} />
                            </button>
                            <input
                                id="video-default-cover-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadContentAsset(e, setVideoDefaultCoverURL)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                            视频 speaker 默认头像
                        </label>
                        <div className="flex items-center gap-3">
                            {videoSpeakerDefaultAvatarURL && (
                                <img src={siteResourceURL(videoSpeakerDefaultAvatarURL)} alt="视频 speaker 默认头像" className="h-10 w-10 rounded-full object-cover" />
                            )}
                            <button
                                type="button"
                                onClick={() => document.getElementById('video-speaker-default-avatar-upload')?.click()}
                                className="px-2 rounded-lg hover:bg-black/5 transition-colors"
                                style={{ border: '1px solid #e5e5e5', color: '#0f0f0f' }}
                                disabled={uploading}
                            >
                                <Upload size={16} />
                            </button>
                            <input
                                id="video-speaker-default-avatar-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadContentAsset(e, setVideoSpeakerDefaultAvatarURL)}
                            />
                        </div>
                    </div>
                </div>
                <p className="mt-3 text-xs" style={{ color: '#606060' }}>
                    当视频未设置封面、speaker 未设置头像时，会自动回退到这里配置的默认资源。图集会优先使用已上传图片中的封面图或首张图片。
                </p>
            </div>

            {/* Copyright & Security */}
            <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
                <div className="flex items-center gap-2 mb-6">
                    <Shield size={20} style={{ color: '#0f0f0f' }} />
                    <h3 className="font-medium" style={{ color: '#0f0f0f' }}>版权与安全</h3>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                            版权标识
                        </label>
                        <Input
                            placeholder="Niubility"
                            value={copyright}
                            onChange={(e) => setCopyright(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={forceHTTPS}
                                    onChange={(e) => setForceHTTPS(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                            </label>
                        </div>
                        <div>
                            <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>强制 HTTPS</span>
                            <p className="text-xs" style={{ color: '#606060' }}>开启后所有 HTTP 请求将重定向到 HTTPS（生产环境建议开启）</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
                <div className="flex items-center gap-2 mb-6">
                    <h3 className="font-medium" style={{ color: '#0f0f0f' }}>页脚内容</h3>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                        页脚内容
                    </label>
                    <p className="text-xs mb-2" style={{ color: '#606060' }}>
                        支持 HTML 格式，留空则不显示
                    </p>
                    <textarea
                        placeholder="支持 HTML 格式，留空则不显示"
                        value={footer}
                        onChange={(e) => setFooter(e.target.value)}
                        className="w-full min-h-32 rounded-lg px-3 py-2 resize-none focus:outline-none"
                        style={{ border: '1px solid #e5e5e5', color: '#0f0f0f' }}
                        rows={3}
                    />
                </div>
            </div>

            {/* Save Button */}
            <SaveButton saving={saving} onClick={handleSave} />
        </div>
    )
}

export default SettingsSite
