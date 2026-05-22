import { useState, useEffect } from 'react'
import { useAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'
import type { TableMeta } from '@/lib/schema'
import { extractEnumValues } from '@/lib/schema'

interface Props {
  visible: boolean
  tableName: string
  meta: TableMeta | null
  recordId: string | null
  mode: 'view' | 'create' | 'edit'
  prefill?: Record<string, unknown>
  onClose: () => void
}

export default function DetailPanel({ visible, tableName, meta, recordId, mode, prefill, onClose }: Props) {
  const { token } = useAuth()
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!visible) return
    if (mode === 'create') {
      setFormData(prefill ? { ...prefill } : {})
      return
    }
    if (!recordId) return
    setLoading(true)
    sdbQuery(`SELECT * FROM ${recordId}`, undefined, token)
      .then((data: any[]) => {
        if (data?.[0]) setFormData({ ...data[0] })
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [visible, recordId, mode])

  async function handleSave() {
    if (!meta) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (mode === 'create') {
        const fields = Object.entries(formData)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ')
        await sdbQuery(`CREATE ${tableName} CONTENT { ${fields} }`, undefined, token)
      } else if (recordId) {
        const updates = Object.entries(formData)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
          .join(', ')
        if (updates) {
          await sdbQuery(`UPDATE ${recordId} MERGE { ${updates} }`, undefined, token)
        }
      }
      setSuccess('保存成功')
      setTimeout(() => onClose(), 800)
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!recordId) return
    try {
      await sdbQuery(`DELETE ${recordId}`, undefined, token)
      onClose()
    } catch (err: any) {
      setError(err.message || '删除失败')
    }
  }

  if (!visible) return null

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000
      }} />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: '#fff', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
        zIndex: 1001, display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e8e8', fontWeight: 600, fontSize: 16 }}>
          {mode === 'create' ? `新建 ${tableName}` : '详情'}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? <div style={{ color: '#999' }}>加载中...</div> : !meta ? null : meta.fields.filter(f => f.name !== 'id').map(field => (
            <div key={field.name} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, color: '#666' }}>
                {field.comment || field.name}
              </label>
              {field.assert && extractEnumValues(field.assert).length > 0 ? (
                <select
                  value={formData[field.name] ?? ''}
                  onChange={e => setFormData(d => ({ ...d, [field.name]: e.target.value }))}
                  disabled={mode === 'view'}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">--</option>
                  {extractEnumValues(field.assert).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : field.kind === 'bool' ? (
                <input
                  type="checkbox"
                  checked={!!formData[field.name]}
                  onChange={e => setFormData(d => ({ ...d, [field.name]: e.target.checked }))}
                  disabled={mode === 'view'}
                />
              ) : field.isRecord ? (
                <span style={{ fontSize: 13, color: '#888' }}>
                  {typeof formData[field.name] === 'object' && formData[field.name] !== null
                    ? (formData[field.name] as any).name || String(formData[field.name])
                    : String(formData[field.name] ?? '-')}
                </span>
              ) : (
                <input
                  type={field.kind === 'int' || field.kind === 'float' ? 'number' : 'text'}
                  value={formData[field.name] ?? ''}
                  onChange={e => setFormData(d => ({ ...d, [field.name]: field.kind === 'int' ? parseInt(e.target.value) || 0 : e.target.value }))}
                  disabled={mode === 'view'}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e8e8e8', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {error && <span style={{ color: '#d93025', fontSize: 13, flex: 1 }}>{error}</span>}
          {success && <span style={{ color: '#52c41a', fontSize: 13, flex: 1 }}>{success}</span>}
          {mode === 'view' ? (
            <>
              <button onClick={onClose} style={btnStyle}>关闭</button>
              <button onClick={handleDelete} style={{ ...btnStyle, color: '#d93025', borderColor: '#d93025' }}>删除</button>
            </>
          ) : (
            <>
              <button onClick={onClose} style={btnStyle}>取消</button>
              <button onClick={handleSave} disabled={saving}
                style={{ ...btnStyle, background: '#1677ff', color: '#fff', borderColor: '#1677ff' }}>
                {saving ? '保存中...' : '保存'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '6px 16px', border: '1px solid #d9d9d9', borderRadius: 6,
  background: '#fff', fontSize: 13, cursor: 'pointer',
}
