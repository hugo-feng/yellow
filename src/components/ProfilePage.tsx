import { useState, useCallback } from 'react'
import { getStoredProfile, storeProfile, changeNickname, changePassword, updateAvatar, uploadToCloud, type UserProfile } from '../utils/github-sync'
import { hasInviteCode, setInviteCode } from '../utils/invite'
import { getAllBooks, getProgress } from '../utils/db'

const AVATARS = ['🐉', '🦅', '🐺', '🦁', '🐯', '🦈', '🐙', '🦂', '🦖', '👻', '🤖', '👽', '🦊', '🐲', '🦋']

interface Props {
  showToast: (msg: string) => void
  onClose: () => void
}

const NICKNAME_COOLDOWN_KEY = 'yellow-nickname-last-change'
const NICKNAME_COOLDOWN_MS = 60 * 1000

function canChangeNickname(): boolean {
  const last = localStorage.getItem(NICKNAME_COOLDOWN_KEY)
  if (!last) return true
  return Date.now() - parseInt(last, 10) >= NICKNAME_COOLDOWN_MS
}

function getNextChangeTime(): string {
  const last = localStorage.getItem(NICKNAME_COOLDOWN_KEY)
  if (!last) return ''
  const remaining = parseInt(last, 10) + NICKNAME_COOLDOWN_MS - Date.now()
  if (remaining <= 0) return ''
  return `${Math.ceil(remaining / 1000)}秒后`
}

export default function ProfilePage({ showToast, onClose }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile)
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatarIndex ?? 0)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [newNickname, setNewNickname] = useState('')
  const [showNicknameForm, setShowNicknameForm] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSelectAvatar = useCallback(async (index: number) => {
    if (!profile || index === selectedAvatar) return
    setLoading(true)
    const { error } = await updateAvatar(profile.userId, index)
    setLoading(false)
    if (error) {
      showToast('更新头像失败: ' + error)
      return
    }
    setSelectedAvatar(index)
    setProfile({ ...profile, avatarIndex: index })
    setShowAvatarPicker(false)
    showToast('头像已更新')
  }, [profile, selectedAvatar, showToast])

  const handleChangeNickname = useCallback(async () => {
    if (!profile) return
    const name = newNickname.trim()
    if (!name) { showToast('请输入新昵称'); return }
    if (name.length < 2 || name.length > 12) { showToast('昵称2-12个字符'); return }
    if (!canChangeNickname()) { showToast(`冷却中，${getNextChangeTime()}可改`); return }

    setLoading(true)
    const { error } = await changeNickname(profile.userId, name)
    setLoading(false)
    if (error) { showToast('修改失败: ' + error); return }

    localStorage.setItem(NICKNAME_COOLDOWN_KEY, String(Date.now()))
    setProfile({ ...profile, nickname: name })
    setNewNickname('')
    setShowNicknameForm(false)
    showToast('昵称已更新')
  }, [profile, newNickname, showToast])

  const handleDeactivateInvite = useCallback(async () => {
    if (!profile) return
    setInviteCode('')
    const updated = { ...profile, inviteCodeActivated: false }
    setProfile(updated)
    storeProfile(updated)
    try {
      const allBooks = await getAllBooks()
      const progressList: any[] = []
      for (const book of allBooks) {
        const prog = await getProgress(book.id)
        if (prog) progressList.push(prog)
      }
      await uploadToCloud({
        books: allBooks, progress: progressList,
        readerSettings: null, theme: localStorage.getItem('theme') || 'light',
        readChapters: {}, inviteCodeActivated: false, syncedAt: new Date().toISOString()
      })
    } catch {}
    showToast('邀请码已清除')
  }, [profile, showToast])

  const handleChangePassword = useCallback(async () => {
    if (!profile) return
    if (!oldPassword) { showToast('请输入原密码'); return }
    if (newPassword.length < 4) { showToast('新密码至少4位'); return }

    setLoading(true)
    const { error } = await changePassword(profile.userId, oldPassword, newPassword)
    setLoading(false)
    if (error) { showToast('修改失败: ' + error); return }

    setOldPassword('')
    setNewPassword('')
    setShowPasswordForm(false)
    showToast('密码已更新')
  }, [profile, oldPassword, newPassword, showToast])

  if (!profile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
        <div className="header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', padding: 0, display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>个人资料</h1>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
            <div style={{ fontSize: 14 }}>请先登录</div>
          </div>
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-primary)',
    color: 'var(--text-primary)', fontSize: 14, marginBottom: 8,
    outline: 'none', boxSizing: 'border-box'
  }

  const entryStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', marginBottom: 2, cursor: 'pointer', background: 'var(--bg-card)',
    border: 'none', color: 'var(--text-primary)', fontSize: 14
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <div className="header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 18, cursor: 'pointer', padding: 0, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>个人资料</h1>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px calc(var(--safe-bottom) + 16px)' }}>
        {/* 头像 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            style={{
              width: 80, height: 80, borderRadius: 40, background: 'var(--bg-card)',
              border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40, cursor: 'pointer', transition: 'transform 0.2s'
            }}
          >
            {AVATARS[selectedAvatar]}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>点击更换头像</div>
        </div>

        {showAvatarPicker && (
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>选择头像</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {AVATARS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectAvatar(i)}
                  disabled={loading}
                  style={{
                    width: '100%', aspectRatio: '1', borderRadius: '50%', border: selectedAvatar === i ? '2px solid var(--accent)' : '2px solid var(--border)',
                    background: selectedAvatar === i ? 'var(--accent-glow)' : 'var(--bg-card)',
                    fontSize: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 昵称 */}
        <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>昵称</h3>
        <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
          <button
            style={{ ...entryStyle, borderRadius: 'var(--radius) var(--radius) 0 0' }}
            onClick={() => setShowNicknameForm(!showNicknameForm)}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>当前昵称</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile.nickname}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', transform: showNicknameForm ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {showNicknameForm && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              {!canChangeNickname() && (
                <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 8 }}>
                  冷却中，{getNextChangeTime()}可再次修改
                </div>
              )}
              <input
                type="text" placeholder="新昵称（2-12个字符）" value={newNickname}
                onChange={e => setNewNickname(e.target.value)} maxLength={12}
                onKeyDown={e => e.key === 'Enter' && handleChangeNickname()}
                style={inputStyle}
              />
              <button
                className="btn btn-primary btn-sm" style={{ width: '100%' }}
                onClick={handleChangeNickname} disabled={loading || !canChangeNickname()}
              >
                {loading ? '修改中...' : '修改昵称'}
              </button>
            </div>
          )}
          <button
            style={{ ...entryStyle, borderTop: '1px solid var(--border)', borderRadius: '0 0 var(--radius) var(--radius)', cursor: 'default' }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>修改密码</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>密码至少4位</div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
            >
              {showPasswordForm ? '取消' : '修改'}
            </button>
          </button>
        </div>

        {showPasswordForm && (
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>修改密码</div>
            <input type="password" placeholder="原密码" value={oldPassword}
              onChange={e => setOldPassword(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="新密码（至少4位）" value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
              style={inputStyle}
            />
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }}
              onClick={handleChangePassword} disabled={loading}>
              {loading ? '修改中...' : '确认修改密码'}
            </button>
          </div>
        )}

        {/* 账号信息 */}
        <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>账号信息</h3>
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>用户ID</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{profile.nickname}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>注册时间</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* 邀请码 */}
        <h3 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 4 }}>邀请码</h3>
        <div className="card" style={{ padding: 16 }}>
          {hasInviteCode() ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                <span style={{ fontSize: 14, color: 'var(--success)', fontWeight: 600 }}>已激活</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDeactivateInvite}
                disabled={loading}
              >
                清除激活
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>未激活</div>
          )}
        </div>
      </div>
    </div>
  )
}
