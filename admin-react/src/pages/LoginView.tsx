import { useState } from 'react'
import { useAuth } from '@/stores/auth'

export default function LoginView() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError('')
    try {
      await login(username, password)
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f0f2f5'
    }}>
      <div style={{
        width: 380, padding: 32, background: '#fff',
        borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 24px', fontWeight: 600 }}>
          RFZv45 <span style={{ color: '#999', fontSize: 14, fontWeight: 400 }}>如法造</span>
        </h2>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#666' }}>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="输入用户名"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#666' }}>密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="输入密码"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>
          {error && <div style={{ color: '#d93025', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: '100%', padding: '10px 0',
              background: loading ? '#91caff' : '#1677ff',
              color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
