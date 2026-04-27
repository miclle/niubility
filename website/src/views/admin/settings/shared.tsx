import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2, Save } from 'lucide-react'

import { listSettings, updateSettings } from 'src/api/setting'

// MASKED_VALUE is the placeholder returned by backend for sensitive values.
export const MASKED_VALUE = '******'

// Setting represents a single key-value pair from the API.
export interface Setting {
  key: string
  value: string
}

// useSettings loads all settings from the API and provides a key-value map.
// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const [loading, setLoading] = useState(true)
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listSettings()
      const map: Record<string, string> = {}
      for (const s of res.data.settings) {
        map[s.key] = s.value
      }
      setSettingsMap(map)
    } catch (err) {
      console.error('Load settings error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { loading, settingsMap, reload: load }
}

// useSaveSettings provides save logic with success/error feedback for a settings sub-page.
// eslint-disable-next-line react-refresh/only-export-components
export function useSaveSettings(reload: () => Promise<void>) {
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const save = useCallback(async (settings: Record<string, string>) => {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      await updateSettings({ settings })
      setSuccess(true)
      await reload()
      return true
    } catch (err) {
      setError('Failed to save, please try again later')
      console.error('Save settings error:', err)
      return false
    } finally {
      setSaving(false)
    }
  }, [reload])

  return { saving, success, error, save }
}

// SettingsLoading renders a centered spinner while settings are loading.
export function SettingsLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="app-text-tertiary animate-spin" />
    </div>
  )
}

// SettingsFeedback renders success/error feedback messages.
export function SettingsFeedback({ success, error }: { success: boolean; error: string }) {
  return (
    <>
      {success && (
        <div className="theme-success-banner p-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={16} />
          <span className="text-sm">Settings saved</span>
        </div>
      )}
      {error && (
        <div className="theme-danger-banner p-3 rounded-lg flex items-center gap-2">
          <XCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </>
  )
}

// SaveButton renders the standard save button for settings pages.
export function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <Button
      disabled={saving}
      onClick={onClick}
      className="theme-primary-button rounded-[18px]"
    >
      {saving ? (
        <><Loader2 size={16} className="animate-spin" /> Saving...</>
      ) : (
        <><Save size={16} /> Save settings</>
      )}
    </Button>
  )
}
