import { useState, useCallback } from 'react'
import { getStoredProfile, clearProfile, createProfile, type UserProfile } from '../utils/github-sync'

interface Props {
  showToast: (msg: string) => void
}

export default function UserSettings({ showToast }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile)
  const [nickname, setNickname] = useState('')
  const [showInput, setShowInput] = useState(false)

  const handleRegister = useCallback(() => {
    const name = nickname.trim()
    if (!name) { showToast('请输入昵称'); return }
    if (name.length < 2 || name.length > 12) { showToast('昵称2-12个字符'); return }
    const p = createProfile(name)
    setProfile(p)
    setNickname('')
    setShowInput(false)
    showToast(`欢迎, ${p.nickname}!`)
  }, [nickname, showToast])

  const handleLogout = useCallback(() => {
    clearProfile()
    setProfile(null)
    showToast('已退出')
  }, [showToast])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: 14, marginBottom: 8,
    outline: 'none', boxSizing: 'border-box'
  }

  if (!profile) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>未登录</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>设置昵称即可使用</div>
          </div>
        </div>
        {!showInput ? (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowInput(true)}>设置昵称</button>
        ) : (
          <div>
            <input type="text" placeholder="输入昵称（2-12个字符）" value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              maxLength={12} style={inputStyle} autoFocus />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowInput(false); setNickname('') }}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRegister}>确认</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 20, background: profile.avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 16
        }}>
          {profile.nickname.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.nickname}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>数据保存在本设备</div>
        </div>
        <button style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }} onClick={handleLogout}>退出</button>
      </div>
    </div>
  )
}
