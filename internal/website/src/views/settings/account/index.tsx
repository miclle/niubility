import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Save, CheckCircle, XCircle, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

import { useAppContext } from 'src/context/app'
import { getProfile, updateProfile } from 'src/api/user'
import { uploadAvatar, avatarURL as resolveAvatarURL } from 'src/api/upload'
import type { User } from 'src/types/user'

// socialFields defines the social account fields with domain prefixes and placeholders.
// Fields with a prefix store only the username; the full URL is assembled on save.
const socialFields = [
  { key: 'github', label: 'GitHub', prefix: 'https://github.com/', placeholder: 'username' },
  { key: 'twitter', label: 'Twitter / X', prefix: 'https://x.com/', placeholder: 'username' },
  { key: 'weibo', label: 'Weibo', prefix: 'https://weibo.com/', placeholder: 'username' },
  { key: 'linkedin', label: 'LinkedIn', prefix: 'https://linkedin.com/in/', placeholder: 'username' },
  { key: 'facebook', label: 'Facebook', prefix: 'https://facebook.com/', placeholder: 'username' },
  { key: 'website', label: 'Website', prefix: '', placeholder: 'https://example.com' },
]

// stripPrefix removes the known prefix from a stored URL to get the username part.
function stripPrefix(value: string, prefix: string): string {
  if (!value || !prefix) return value || ''
  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

// addPrefix prepends the prefix to a username if not empty.
function addPrefix(value: string, prefix: string): string {
  if (!value) return ''
  if (!prefix) return value
  return value.startsWith(prefix) ? value : prefix + value
}

// AccountSettings allows users to edit their own profile.
function AccountSettings() {
  const { currentUser, setCurrentUser } = useAppContext()
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [avatar, setAvatar] = useState('')
  const [socialAccounts, setSocialAccounts] = useState<Record<string, string>>({})

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Load profile data
  const loadProfile = useCallback(async () => {
    try {
      const res = await getProfile()
      const user = res.data
      setName(user.name || '')
      setBio(user.bio || '')
      setLocation(user.location || '')
      setAvatar(user.avatar || '')
      // Strip URL prefixes so inputs show only the username part
      const raw = user.social_accounts || {}
      const stripped: Record<string, string> = {}
      for (const field of socialFields) {
        stripped[field.key] = stripPrefix(raw[field.key] || '', field.prefix)
      }
      setSocialAccounts(stripped)
    } catch {
      setError('加载个人信息失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setAvatarUploading(true)
    try {
      const key = await uploadAvatar(file)
      setAvatar(key)
    } catch {
      setError('头像上传失败')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSocialChange = (key: string, value: string) => {
    setSocialAccounts((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      // Assemble full URLs by adding prefixes back
      const fullSocialAccounts: Record<string, string> = {}
      for (const field of socialFields) {
        fullSocialAccounts[field.key] = addPrefix(socialAccounts[field.key] || '', field.prefix)
      }

      const res = await updateProfile({
        name,
        bio,
        location,
        avatar,
        social_accounts: fullSocialAccounts,
      })
      setSuccess(true)
      // Update global user state
      setCurrentUser(res.data as User)
    } catch {
      setError('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin" style={{ color: '#909090' }} />
      </div>
    )
  }

  const avatarDisplayURL = avatar ? resolveAvatarURL(avatar) : ''

  return (
    <div className="mx-auto py-8 px-6" style={{ maxWidth: 960 }}>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>账户设置</h1>

      {/* Two-column layout: form left, avatar right */}
      <div className="flex gap-10">
        {/* Left column: form fields */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Basic info section */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm mb-1.5 block" style={{ color: '#606060' }}>姓名</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="输入你的姓名" />
            </div>

            <div>
              <Label htmlFor="bio" className="text-sm mb-1.5 block" style={{ color: '#606060' }}>个人简介</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="介绍一下你自己" rows={3} />
            </div>

            <div>
              <Label htmlFor="location" className="text-sm mb-1.5 block" style={{ color: '#606060' }}>所在地</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例如：上海" />
            </div>
          </div>

          {/* Social accounts section */}
          <div className="space-y-4">
            <h2 className="text-base font-medium" style={{ color: '#0f0f0f' }}>社交账号</h2>

            {socialFields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={`social-${field.key}`} className="text-sm mb-1.5 block" style={{ color: '#606060' }}>{field.label}</Label>
                {field.prefix ? (
                  <div className="flex items-stretch rounded-lg overflow-hidden" style={{ border: '1px solid var(--input)' }}>
                    <span
                      className="flex items-center px-2.5 text-sm select-none shrink-0"
                      style={{ background: '#f5f5f5', color: '#909090', borderRight: '1px solid var(--input)' }}
                    >
                      {field.prefix}
                    </span>
                    <input
                      id={`social-${field.key}`}
                      value={socialAccounts[field.key] || ''}
                      onChange={(e) => handleSocialChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="h-8 flex-1 min-w-0 bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                ) : (
                  <Input
                    id={`social-${field.key}`}
                    value={socialAccounts[field.key] || ''}
                    onChange={(e) => handleSocialChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Feedback */}
          {success && (
            <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#dcfce7' }}>
              <CheckCircle size={16} style={{ color: '#166534' }} />
              <span className="text-sm" style={{ color: '#166534' }}>个人信息已保存</span>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#fee2e2' }}>
              <XCircle size={16} style={{ color: '#991b1b' }} />
              <span className="text-sm" style={{ color: '#991b1b' }}>{error}</span>
            </div>
          )}

          {/* Save button */}
          <Button
            disabled={saving}
            onClick={handleSave}
            style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> 保存中...</>
            ) : (
              <><Save size={16} /> 保存</>
            )}
          </Button>
        </div>

        {/* Right column: avatar */}
        <div className="flex-shrink-0" style={{ width: 200 }}>
          <Label className="text-sm font-medium mb-3 block" style={{ color: '#606060' }}>头像</Label>
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <Avatar style={{ width: 200, height: 200 }}>
              <AvatarImage src={avatarDisplayURL} alt={name} />
              <AvatarFallback style={{ fontSize: 64 }}>{name?.charAt(0) || currentUser?.username?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              {avatarUploading ? (
                <Loader2 size={32} className="animate-spin" style={{ color: '#ffffff' }} />
              ) : (
                <Camera size={32} style={{ color: '#ffffff' }} />
              )}
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="mt-3 w-full text-sm px-4 py-1.5 rounded-md transition-colors cursor-pointer"
            style={{ border: '1px solid #d0d7de', background: '#f6f8fa', color: '#24292f' }}
          >
            更换头像
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccountSettings
