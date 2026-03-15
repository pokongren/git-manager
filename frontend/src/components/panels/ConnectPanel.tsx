import { useState, useEffect, useCallback } from 'react'
import * as api from '../../api'
import { useToast } from '../../hooks/useToast'
import { saveRecentRepo, getRecentRepos } from '../../utils'

interface ConnectPanelProps {
  onRepoConnected: () => void
}

export default function ConnectPanel({ onRepoConnected }: ConnectPanelProps) {
  const { showToast } = useToast()
  const [repoPath, setRepoPath] = useState('')
  const [recentRepos, setRecentRepos] = useState<string[]>([])
  const [browsing, setBrowsing] = useState(false)
  const [repoInfoCard, setRepoInfoCard] = useState<{ root: string; branch: string; remote: string } | null>(null)

  // 克隆表单
  const [cloneExpanded, setCloneExpanded] = useState(false)
  const [cloneUrl, setCloneUrl] = useState('')
  const [clonePath, setClonePath] = useState('')
  const [cloning, setCloning] = useState(false)

  useEffect(() => {
    setRecentRepos(getRecentRepos())
  }, [])

  const handleBrowse = useCallback(async () => {
    setBrowsing(true)
    try {
      const result = await api.browseFolderDialog()
      if (result.success && result.path) {
        setRepoPath(result.path)
      }
    } catch (error) {
      showToast('无法打开文件夹选择对话框：' + (error instanceof Error ? error.message : ''), 'error')
    } finally {
      setBrowsing(false)
    }
  }, [showToast])

  const handleConnect = useCallback(async () => {
    const path = repoPath.trim()
    if (!path) {
      showToast('请输入仓库路径', 'error')
      return
    }
    try {
      await api.openRepo(path)
      showToast('仓库连接成功', 'success')
      saveRecentRepo(path)
      setRecentRepos(getRecentRepos())

      // 获取仓库信息
      const info = await api.getRepoInfo()
      if (info.connected) {
        setRepoInfoCard({
          root: info.root || '-',
          branch: info.current_branch || '-',
          remote: info.remotes ? info.remotes.split('\n')[0] : '无',
        })
      }
      onRepoConnected()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '连接失败', 'error')
    }
  }, [repoPath, showToast, onRepoConnected])

  const handleBrowseClone = useCallback(async () => {
    try {
      const result = await api.browseFolderDialog()
      if (result.success && result.path) {
        setClonePath(result.path)
      }
    } catch (error) {
      showToast('无法打开文件夹选择对话框：' + (error instanceof Error ? error.message : ''), 'error')
    }
  }, [showToast])

  const handleClone = useCallback(async () => {
    if (!cloneUrl.trim()) {
      showToast('请输入远程仓库 URL', 'error')
      return
    }
    if (!clonePath.trim()) {
      showToast('请输入本地保存目录', 'error')
      return
    }
    setCloning(true)
    try {
      const data = await api.cloneRepo(cloneUrl.trim(), clonePath.trim())
      showToast(data.message, 'success')
      saveRecentRepo(clonePath.trim())
      setRecentRepos(getRecentRepos())
      setCloneUrl('')
      setClonePath('')
      onRepoConnected()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '克隆失败', 'error')
    } finally {
      setCloning(false)
    }
  }, [cloneUrl, clonePath, showToast, onRepoConnected])

  // URL 输入时自动推断本地目录名
  const handleCloneUrlChange = useCallback((url: string) => {
    setCloneUrl(url)
    if (!clonePath.trim() && url.trim()) {
      const match = url.trim().match(/\/([^/]+?)(\.git)?$/)
      if (match?.[1]) {
        setClonePath('D:\\Git\\' + match[1])
      }
    }
  }, [clonePath])

  return (
    <div className="panel active" id="panel-connect">
      <div className="panel-header">
        <h1>连接 Git 仓库</h1>
        <p className="panel-desc">输入本地 Git 仓库路径以开始管理</p>
      </div>
      <div className="panel-body">
        {/* 连接仓库卡片 */}
        <div className="connect-card">
          <div className="input-group">
            <label htmlFor="repo-path-input">仓库路径</label>
            <div className="input-row">
              <input
                type="text"
                id="repo-path-input"
                placeholder="例如：D:\projects\my-repo"
                spellCheck={false}
                value={repoPath}
                onChange={e => setRepoPath(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConnect() }}
              />
              <button className="btn btn-outline" onClick={handleBrowse} disabled={browsing} title="选择文件夹">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {browsing ? '选择中…' : '浏览'}
              </button>
              <button className="btn btn-primary" onClick={handleConnect}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                连接
              </button>
            </div>
          </div>

          {/* 最近仓库列表 */}
          {recentRepos.length > 0 && (
            <div className="recent-repos">
              <div className="recent-repos-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>最近打开</span>
              </div>
              <div className="recent-repos-list">
                {recentRepos.map(repo => (
                  <div
                    key={repo}
                    className="recent-repo-item"
                    onClick={() => { setRepoPath(repo); }}
                    style={{ cursor: 'pointer', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {repo}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 仓库信息卡片 */}
          {repoInfoCard && (
            <div className="info-card">
              <div className="info-row"><span className="info-label">仓库根目录</span><span className="info-value">{repoInfoCard.root}</span></div>
              <div className="info-row"><span className="info-label">当前分支</span><span className="info-value">{repoInfoCard.branch}</span></div>
              <div className="info-row"><span className="info-label">远程仓库</span><span className="info-value">{repoInfoCard.remote}</span></div>
            </div>
          )}
        </div>

        {/* 克隆远程仓库 */}
        <div className="connect-card" style={{ marginTop: 20, border: '1px solid var(--color-primary)', background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, var(--bg-card) 100%)' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}
            onClick={() => setCloneExpanded(!cloneExpanded)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-primary)' }}>⬇️ 克隆远程仓库</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>从 GitHub / Gitee 下载项目</span>
            <svg
              className={`clone-chevron ${cloneExpanded ? 'open' : ''}`}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2"
              style={{ transition: 'transform 0.2s', transform: cloneExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {cloneExpanded && (
            <div>
              <div className="input-group">
                <label htmlFor="clone-url-input">远程仓库 URL</label>
                <input
                  type="text"
                  id="clone-url-input"
                  placeholder="https://github.com/user/repo.git"
                  spellCheck={false}
                  value={cloneUrl}
                  onChange={e => handleCloneUrlChange(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="clone-path-input">本地保存目录</label>
                <div className="input-row">
                  <input
                    type="text"
                    id="clone-path-input"
                    placeholder="例如：D:\projects\my-repo"
                    spellCheck={false}
                    value={clonePath}
                    onChange={e => setClonePath(e.target.value)}
                  />
                  <button className="btn btn-outline" onClick={handleBrowseClone} title="选择文件夹">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    浏览
                  </button>
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: 14 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleClone}
                  disabled={cloning}
                  style={{ width: '100%', justifyContent: 'center', background: 'var(--color-primary)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {cloning ? '正在克隆，请稍候...' : '开始克隆'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
