import client from './client'
import type { ListSettingsResponse, UpdateSettingsRequest } from 'src/types/setting'

// listSettings fetches all settings (admin only).
export function listSettings() {
  return client.get<ListSettingsResponse>('/settings')
}

// updateSettings updates the settings (admin only).
export function updateSettings(data: UpdateSettingsRequest) {
  return client.patch<ListSettingsResponse>('/settings', data)
}
