export interface BackupRecord {
  id: string
  type: string
  status: 'running' | 'success' | 'failed'
  method: 'native_tool' | 'go_builtin' | ''
  node_id: string
  driver: 'postgres' | 'mysql' | string
  object_key: string
  file_name: string
  file_size: number
  compressed: boolean
  checksum_sha256: string
  started_by_user_id: string
  started_by_name: string
  started_at: string
  finished_at: string | null
  duration_ms: number
  error_message: string
  created_at: string
  updated_at: string
}

export interface StartDatabaseBackupResponse {
  backup: BackupRecord
}

export interface ListDatabaseBackupsResponse {
  items: BackupRecord[]
  total: number
}

export interface DatabaseBackupDownloadResponse {
  url: string
  expires_at: string
}
