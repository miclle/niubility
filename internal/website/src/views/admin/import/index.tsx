import { useState, useRef } from 'react'
import { Button, TextArea } from '@radix-ui/themes'
import { Upload, FileJson, CheckCircle, XCircle, Loader2 } from 'lucide-react'

import { importContents } from 'src/api/content'
import type { ImportResult, LegacyTalk } from 'src/types/content'

// AdminImport provides an interface for importing data from the legacy platform.
function AdminImport() {
  const [data, setData] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setData(content)
      setResult(null)
      setError('')
    }
    reader.readAsText(file)
    // Reset file input so the same file can be selected again
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!data.trim()) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      let contents: LegacyTalk[]
      try {
        contents = JSON.parse(data)
        if (!Array.isArray(contents)) {
          throw new Error('Data must be an array')
        }
      } catch {
        setError('JSON 格式无效，请确保数据是数组格式')
        return
      }

      const res = await importContents({ contents })
      setResult(res)
    } catch (err) {
      setError('导入失败，请稍后重试')
      console.error('Import error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>数据导入</h1>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        {/* File upload */}
        <div className="mb-4">
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileUpload}
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
              setResult(null)
              setError('')
            }}
            rows={12}
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
          <div className="mb-4 p-4 rounded-lg" style={{ background: '#dcfce7' }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} style={{ color: '#166534' }} />
              <span className="text-sm font-medium" style={{ color: '#166534' }}>导入完成</span>
            </div>
            <div className="text-sm space-y-1" style={{ color: '#166534' }}>
              <p>总计: {result.total} 条</p>
              <p>已导入: {result.imported} 条</p>
              <p>跳过 (已存在): {result.skipped} 条</p>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">错误:</p>
                  {result.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-xs">{err}</p>
                  ))}
                  {result.errors.length > 5 && (
                    <p className="text-xs">...还有 {result.errors.length - 5} 条错误</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Import button */}
        <Button
          size="2"
          disabled={loading || !data.trim()}
          onClick={handleImport}
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
            <>
              <FileJson size={16} />
              开始导入
            </>
          )}
        </Button>
      </div>

      {/* Instructions */}
      <div
        className="mt-6 p-4 rounded-xl"
        style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}
      >
        <h4 className="font-medium mb-2" style={{ color: '#0f0f0f' }}>导入说明</h4>
        <ul className="text-sm space-y-1" style={{ color: '#606060' }}>
          <li>• 系统根据数据中的 <code className="px-1 py-0.5 rounded" style={{ background: '#e5e5e5' }}>type</code> 字段自动区分分类</li>
          <li>• <code className="px-1 py-0.5 rounded" style={{ background: '#e5e5e5' }}>type: "sharing"</code> → 学习交流</li>
          <li>• <code className="px-1 py-0.5 rounded" style={{ background: '#e5e5e5' }}>type: "training"</code> → 企业文化</li>
          <li>• 所有导入的内容类型为「视频」</li>
          <li>• 重复标题的内容会被跳过</li>
          <li>• 数据文件位于项目 <code className="px-1 py-0.5 rounded" style={{ background: '#e5e5e5' }}>tmp/</code> 目录</li>
        </ul>
      </div>
    </div>
  )
}

export default AdminImport
