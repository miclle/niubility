import { useState, useRef } from 'react'
import { Button, TextArea } from '@radix-ui/themes'
import { Upload, FileJson, CheckCircle, XCircle, Loader2 } from 'lucide-react'

import { importContents } from 'src/api/content'
import type { ImportResult } from 'src/types/content'

// LegacyTalk represents the data structure from the old platform.
interface LegacyTalk {
  id: string
  title: string
  cover: string
  description: string
  tags: string[]
  speaker: string
  bio: string
  playback: string
  type: string
  volume: string
  created_at: string
}

// AdminImport provides an interface for importing data from the legacy platform.
function AdminImport() {
  const [sharingData, setSharingData] = useState('')
  const [trainingData, setTrainingData] = useState('')
  const [sharingResult, setSharingResult] = useState<ImportResult | null>(null)
  const [trainingResult, setTrainingResult] = useState<ImportResult | null>(null)
  const [sharingLoading, setSharingLoading] = useState(false)
  const [trainingLoading, setTrainingLoading] = useState(false)
  const [sharingError, setSharingError] = useState('')
  const [trainingError, setTrainingError] = useState('')

  const sharingFileRef = useRef<HTMLInputElement>(null)
  const trainingFileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (type: 'sharing' | 'training', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (type === 'sharing') {
        setSharingData(content)
        setSharingResult(null)
        setSharingError('')
      } else {
        setTrainingData(content)
        setTrainingResult(null)
        setTrainingError('')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async (source: 'sharing' | 'training') => {
    const data = source === 'sharing' ? sharingData : trainingData
    if (!data.trim()) return

    if (source === 'sharing') {
      setSharingLoading(true)
      setSharingError('')
    } else {
      setTrainingLoading(true)
      setTrainingError('')
    }

    try {
      let contents: LegacyTalk[]
      try {
        contents = JSON.parse(data)
      } catch {
        if (source === 'sharing') {
          setSharingError('JSON 格式无效，请检查数据格式')
        } else {
          setTrainingError('JSON 格式无效，请检查数据格式')
        }
        return
      }

      const result = await importContents({ source, contents })
      if (source === 'sharing') {
        setSharingResult(result)
      } else {
        setTrainingResult(result)
      }
    } catch (err) {
      if (source === 'sharing') {
        setSharingError('导入失败，请稍后重试')
      } else {
        setTrainingError('导入失败，请稍后重试')
      }
    } finally {
      if (source === 'sharing') {
        setSharingLoading(false)
      } else {
        setTrainingLoading(false)
      }
    }
  }

  const renderImportCard = (
    type: 'sharing' | 'training',
    title: string,
    description: string,
    data: string,
    setData: (data: string) => void,
    result: ImportResult | null,
    loading: boolean,
    error: string,
    fileRef: React.RefObject<HTMLInputElement | null>
  ) => (
    <div
      className="bg-white rounded-xl p-6"
      style={{ border: '1px solid #e5e5e5' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: type === 'sharing' ? '#dcfce7' : '#fef3c7' }}
        >
          <FileJson size={20} style={{ color: type === 'sharing' ? '#166534' : '#92400e' }} />
        </div>
        <div>
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>{title}</h3>
          <p className="text-sm" style={{ color: '#606060' }}>{description}</p>
        </div>
      </div>

      {/* File upload */}
      <div className="mb-4">
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => handleFileUpload(type, e)}
        />
        <Button
          variant="soft"
          size="2"
          onClick={() => fileRef.current?.click()}
          style={{ borderRadius: '18px', background: '#f2f2f2', color: '#0f0f0f' }}
        >
          <Upload size={16} />
          选择 JSON 文件
        </Button>
      </div>

      {/* JSON textarea */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>
          JSON 数据
        </label>
        <TextArea
          size="2"
          placeholder="粘贴 JSON 数据或上传文件..."
          value={data}
          onChange={(e) => {
            setData(e.target.value)
            if (type === 'sharing') {
              setSharingResult(null)
              setSharingError('')
            } else {
              setTrainingResult(null)
              setTrainingError('')
            }
          }}
          rows={8}
          style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 12 }}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: '#fee2e2' }}>
          <XCircle size={16} style={{ color: '#991b1b' }} />
          <span className="text-sm" style={{ color: '#991b1b' }}>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: '#dcfce7' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} style={{ color: '#166534' }} />
            <span className="text-sm font-medium" style={{ color: '#166534' }}>导入完成</span>
          </div>
          <div className="text-sm" style={{ color: '#166534' }}>
            <p>总计: {result.total} 条</p>
            <p>已导入: {result.imported} 条</p>
            <p>跳过 (已存在): {result.skipped} 条</p>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">错误:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs">{err}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import button */}
      <Button
        size="2"
        disabled={loading || !data.trim()}
        onClick={() => handleImport(type)}
        style={{
          background: '#0f0f0f',
          color: '#ffffff',
          borderRadius: '18px',
        }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            导入中...
          </>
        ) : (
          '开始导入'
        )}
      </Button>
    </div>
  )

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>数据导入</h1>

      <div className="grid grid-cols-2 gap-6">
        {renderImportCard(
          'sharing',
          '分享会数据',
          'talk-sharing.json → 学习交流',
          sharingData,
          setSharingData,
          sharingResult,
          sharingLoading,
          sharingError,
          sharingFileRef
        )}

        {renderImportCard(
          'training',
          '培训数据',
          'talk-training.json → 企业文化',
          trainingData,
          setTrainingData,
          trainingResult,
          trainingLoading,
          trainingError,
          trainingFileRef
        )}
      </div>

      {/* Instructions */}
      <div
        className="mt-6 p-4 rounded-xl"
        style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}
      >
        <h4 className="font-medium mb-2" style={{ color: '#0f0f0f' }}>导入说明</h4>
        <ul className="text-sm space-y-1" style={{ color: '#606060' }}>
          <li>• 分享会数据将导入为「学习交流」分类</li>
          <li>• 培训数据将导入为「企业文化」分类</li>
          <li>• 所有导入的内容类型为「视频」</li>
          <li>• 重复标题的内容会被跳过</li>
          <li>• 数据文件位于项目 <code className="px-1 py-0.5 rounded" style={{ background: '#e5e5e5' }}>tmp/</code> 目录</li>
        </ul>
      </div>
    </div>
  )
}

export default AdminImport
