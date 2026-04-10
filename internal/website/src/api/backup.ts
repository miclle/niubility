import client from './client'
import type { DatabaseBackupDownloadResponse, ListDatabaseBackupsResponse, StartDatabaseBackupResponse } from 'src/types/backup'

export function listDatabaseBackups(page = 1, pageSize = 20) {
  return client.get<ListDatabaseBackupsResponse>('/admin/backups/database', {
    params: { page, page_size: pageSize },
  })
}

export function startDatabaseBackup() {
  return client.post<StartDatabaseBackupResponse>('/admin/backups/database')
}

export function getDatabaseBackupDownloadURL(id: string) {
  return client.get<DatabaseBackupDownloadResponse>(`/admin/backups/database/${id}/download`)
}
