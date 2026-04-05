import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings, Shield, RefreshCw, CheckCircle, XCircle, Loader2, Users, Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { syncWechat } from 'src/api/user'
import { MASKED_VALUE, useSettings, useSaveSettings, SettingsLoading, SettingsFeedback, SaveButton } from './shared'

// SettingsWechat provides the WeChat Work settings page with sync functionality.
function SettingsWechat() {
  const { t } = useTranslation('admin')
  const { loading, settingsMap, reload } = useSettings()
  const { saving, success, error, save } = useSaveSettings(reload)

  const [hasExistingWechatSecret, setHasExistingWechatSecret] = useState(false)
  const [wechatForm, setWechatForm] = useState({ corp_id: '', app_agentid: '', app_secret: '' })

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ departments_synced: number; users_synced: number; users_failed: number } | null>(null)
  const [syncError, setSyncError] = useState('')

  useEffect(() => {
    if (loading) return
    const wechat = {
      corp_id: settingsMap['wechat.corp_id'] || '',
      app_agentid: settingsMap['wechat.app_agentid'] || '',
      app_secret: '',
    }
    if (settingsMap['wechat.app_secret'] === MASKED_VALUE) {
      setHasExistingWechatSecret(true)
    } else {
      wechat.app_secret = settingsMap['wechat.app_secret'] || ''
    }
    setWechatForm(wechat)
  }, [loading, settingsMap])

  const handleSave = () => {
    const settings: Record<string, string> = {
      'wechat.corp_id': wechatForm.corp_id,
      'wechat.app_agentid': wechatForm.app_agentid,
    }
    if (wechatForm.app_secret || !hasExistingWechatSecret) {
      settings['wechat.app_secret'] = wechatForm.app_secret
    }
    save(settings)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncError('')
    setSyncResult(null)

    try {
      const res = await syncWechat()
      setSyncResult(res.data)
    } catch (err) {
      setSyncError(t('admin:syncFailed'))
      console.error('Sync error:', err)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <SettingsLoading />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>{t('admin:wechatConfig')}</h1>

      <SettingsFeedback success={success} error={error} />

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <Settings size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>{t('admin:wechatConfig')}</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:corpID')}</label>
            <Input
              placeholder={t('admin:corpIDPlaceholder')}
              value={wechatForm.corp_id}
              onChange={(e) => setWechatForm({ ...wechatForm, corp_id: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:appAgentID')}</label>
            <Input
              placeholder={t('admin:appAgentIDPlaceholder')}
              value={wechatForm.app_agentid}
              onChange={(e) => setWechatForm({ ...wechatForm, app_agentid: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              {t('admin:appSecret')}
              {hasExistingWechatSecret && (
                <span className="ml-2 text-xs" style={{ color: '#166534' }}>{t('admin:synced')}</span>
              )}
            </label>
            <Input
              type="password"
              placeholder={hasExistingWechatSecret ? t('admin:appSecretPlaceholderSet') : t('admin:appSecretPlaceholderNew')}
              value={wechatForm.app_secret}
              onChange={(e) => setWechatForm({ ...wechatForm, app_secret: e.target.value })}
            />
          </div>
        </div>
      </div>

      <SaveButton saving={saving} onClick={handleSave} />

      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>{t('admin:sensitiveInfoNote')}</span>
        </div>
      </div>

      {/* WeChat Sync Section */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>{t('admin:wechatSync')}</h3>
        </div>

        <p className="text-sm mb-4" style={{ color: '#606060' }}>
          {t('admin:wechatSyncDesc')}
        </p>

        {/* Sync result */}
        {syncResult && (
          <div className="mb-4 p-4 rounded-lg" style={{ background: syncResult.users_failed > 0 ? '#fef3c7' : '#dcfce7' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} style={{ color: syncResult.users_failed > 0 ? '#92400e' : '#166534' }} />
              <span className="text-sm font-medium" style={{ color: syncResult.users_failed > 0 ? '#92400e' : '#166534' }}>
                {t('admin:syncComplete')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 ml-6">
              <div className="flex items-center gap-2">
                <Building2 size={14} style={{ color: '#606060' }} />
                <span className="text-sm" style={{ color: '#606060' }}>
                  {t('admin:syncDeptCount')}: <span className="font-medium" style={{ color: '#0f0f0f' }}>{syncResult.departments_synced}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: '#606060' }} />
                <span className="text-sm" style={{ color: '#606060' }}>
                  {t('admin:syncUserCount')}: <span className="font-medium" style={{ color: '#166534' }}>{syncResult.users_synced}</span>
                </span>
              </div>
              {syncResult.users_failed > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle size={14} style={{ color: '#991b1b' }} />
                  <span className="text-sm" style={{ color: '#991b1b' }}>
                    {t('admin:syncFailedCount')}: {syncResult.users_failed}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sync error */}
        {syncError && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: '#fee2e2' }}>
            <XCircle size={16} style={{ color: '#991b1b' }} />
            <span className="text-sm" style={{ color: '#991b1b' }}>{syncError}</span>
          </div>
        )}

        {/* Sync button */}
        <Button
          disabled={syncing}
          onClick={handleSync}
          style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}
        >
          {syncing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('admin:syncing')}
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              {t('admin:syncDeptAndUsers')}
            </>
          )}
        </Button>
      </div>

      {/* Sync instructions */}
      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <h4 className="font-medium mb-2" style={{ color: '#0f0f0f' }}>{t('admin:syncInstructions')}</h4>
        <ul className="text-sm space-y-1" style={{ color: '#606060' }}>
          <li>• {t('admin:syncInstructionsList')}</li>
        </ul>
      </div>
    </div>
  )
}

export default SettingsWechat
