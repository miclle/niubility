import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Database, Download, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import Pagination from 'src/components/Pagination'
import { getDatabaseBackupDownloadURL, listDatabaseBackups, startDatabaseBackup } from 'src/api/backup'
import type { BackupRecord } from 'src/types/backup'

function formatFileSize(size: number) {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function statusColor(status: string) {
  if (status === 'success') return { background: '#dcfce7', color: '#166534' }
  if (status === 'failed') return { background: '#fee2e2', color: '#991b1b' }
  return { background: '#f3f4f6', color: '#374151' }
}

function DatabaseBackups() {
  const { t } = useTranslation('admin')
  const pageSize = 20
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<BackupRecord[]>([])
  const [latestItems, setLatestItems] = useState<BackupRecord[]>([])

  const load = useCallback(async (targetPage = 1, silent = false) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')
    try {
      const currentPagePromise = listDatabaseBackups(targetPage, pageSize)
      const latestPagePromise = targetPage === 1 ? currentPagePromise : listDatabaseBackups(1, pageSize)
      const [currentPageRes, latestPageRes] = await Promise.all([currentPagePromise, latestPagePromise])
      setItems(currentPageRes.data.items)
      setTotal(currentPageRes.data.total)
      setLatestItems(latestPageRes.data.items)
    } catch (err) {
      console.error('Load database backups error:', err)
      setError(t('admin:databaseBackupLoadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [pageSize, t])

  useEffect(() => {
    load(page)
  }, [load, page])

  const runningBackup = useMemo(() => latestItems.find((item) => item.status === 'running'), [latestItems])
  const latestSuccess = useMemo(() => latestItems.find((item) => item.status === 'success'), [latestItems])

  const handleStartBackup = async () => {
    if (!window.confirm(t('admin:databaseBackupConfirm'))) {
      return
    }
    setStarting(true)
    setError('')
    try {
      await startDatabaseBackup()
      if (page !== 1) {
        setPage(1)
      } else {
        await load(1, true)
      }
    } catch (err: any) {
      console.error('Start database backup error:', err)
      setError(err?.response?.data?.message || t('admin:databaseBackupStartFailed'))
    } finally {
      setStarting(false)
    }
  }

  const handleDownload = async (id: string) => {
    try {
      const res = await getDatabaseBackupDownloadURL(id)
      window.open(res.data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('Get database backup download URL error:', err)
      setError(t('admin:databaseBackupDownloadFailed'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin" style={{ color: '#909090' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database size={20} style={{ color: '#0f0f0f' }} />
              <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>{t('admin:databaseBackup')}</h1>
            </div>
            <p className="text-sm" style={{ color: '#606060' }}>{t('admin:databaseBackupDesc')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => load(page, true)}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {t('admin:refresh')}
            </Button>
            <Button
              type="button"
              onClick={handleStartBackup}
              disabled={starting || !!runningBackup}
              style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}
            >
              {starting || runningBackup ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
              {runningBackup ? t('admin:databaseBackupRunning') : t('admin:startDatabaseBackup')}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: '#fee2e2', color: '#991b1b' }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="rounded-xl p-4" style={{ border: '1px solid #e5e5e5' }}>
            <div className="text-sm mb-1" style={{ color: '#606060' }}>{t('admin:databaseType')}</div>
            <div className="text-lg font-medium" style={{ color: '#0f0f0f' }}>{latestSuccess?.driver || runningBackup?.driver || '-'}</div>
          </div>
          <div className="rounded-xl p-4" style={{ border: '1px solid #e5e5e5' }}>
            <div className="text-sm mb-1" style={{ color: '#606060' }}>{t('admin:lastSuccessfulBackup')}</div>
            <div className="text-lg font-medium" style={{ color: '#0f0f0f' }}>
              {latestSuccess ? dayjs(latestSuccess.finished_at || latestSuccess.started_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ border: '1px solid #e5e5e5' }}>
            <div className="text-sm mb-1" style={{ color: '#606060' }}>{t('admin:currentBackupStatus')}</div>
            <div className="text-lg font-medium" style={{ color: '#0f0f0f' }}>
              {runningBackup ? t('admin:databaseBackupRunning') : t('admin:noRunningBackup')}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-medium" style={{ color: '#0f0f0f' }}>{t('admin:databaseBackupHistory')}</h2>
          <span className="text-sm" style={{ color: '#606060' }}>{t('admin:backupRecordCount', { count: total })}</span>
        </div>

        {items.length === 0 ? (
          <div className="py-10 text-sm text-center" style={{ color: '#909090' }}>{t('admin:noDatabaseBackups')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <th className="px-3 py-3 text-left text-sm font-semibold" style={{ color: '#606060' }}>{t('admin:status')}</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold" style={{ color: '#606060' }}>{t('admin:fileName')}</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold" style={{ color: '#606060' }}>{t('admin:fileSize')}</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold" style={{ color: '#606060' }}>{t('admin:operator')}</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold" style={{ color: '#606060' }}>{t('admin:startedAt')}</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold" style={{ color: '#606060' }}>{t('admin:duration')}</th>
                  <th className="px-3 py-3 text-left text-sm font-semibold" style={{ color: '#606060' }}>{t('admin:actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const colors = statusColor(item.status)
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td className="px-3 py-4">
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium" style={colors}>
                          {t(`admin:backupStatus.${item.status}`)}
                        </span>
                        {item.error_message && (
                          <div className="text-xs mt-2 max-w-xs" style={{ color: '#991b1b' }}>{item.error_message}</div>
                        )}
                      </td>
                      <td className="px-3 py-4 text-sm" style={{ color: '#0f0f0f' }}>{item.file_name || '-'}</td>
                      <td className="px-3 py-4 text-sm" style={{ color: '#0f0f0f' }}>{formatFileSize(item.file_size)}</td>
                      <td className="px-3 py-4 text-sm" style={{ color: '#0f0f0f' }}>{item.started_by_name || '-'}</td>
                      <td className="px-3 py-4 text-sm" style={{ color: '#0f0f0f' }}>{dayjs(item.started_at).format('YYYY-MM-DD HH:mm:ss')}</td>
                      <td className="px-3 py-4 text-sm" style={{ color: '#0f0f0f' }}>
                        {item.duration_ms > 0 ? `${(item.duration_ms / 1000).toFixed(1)}s` : '-'}
                      </td>
                      <td className="px-3 py-4">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={item.status !== 'success'}
                          onClick={() => handleDownload(item.id)}
                        >
                          <Download size={16} />
                          {t('admin:download')}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          limit={pageSize}
          total={total}
          onChange={setPage}
        />
      </div>
    </div>
  )
}

export default DatabaseBackups
