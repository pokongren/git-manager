import { useState, useCallback, useEffect } from 'react'
import * as api from '../../api'
import type { RemoteInfo } from '../../api'
import { useToast } from '../../hooks/useToast'

/**
 * 分支同步状态总览组件
 * NOTE: 多人协作时一眼看出哪些分支需要推送或拉取
 */
function SyncStatusOverview() {
  const [syncData, setSyncData] = useState<{
    branches: { name: string; ahead: number; behind: number; remote_branch: string }[]
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const loadSyncStatus = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getSyncStatus()
      setSyncData(data)
    } catch {
      // 静默失败，可能没配置远程
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSyncStatus()
  }, [loadSyncStatus])

  if (!syncData || syncData.branches.length === 0) return null

  const needsPush = syncData.branches.filter(b => b.ahead > 0)
  const needsPull = syncData.branches.filter(b => b.behind > 0)
  const synced = syncData.branches.filter(b => b.ahead === 0 && b.behind === 0)

  return (
    <div className="form-card" style={{ marginBottom: 20, border: '1px solid var(--border-muted)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
          <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
        </svg>
        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)' }}>📊 分支同步状态总览</span>
        <button className="btn btn-sm btn-ghost" onClick={loadSyncStatus} disabled={loading} style={{ marginLeft: 'auto', padding: '2px 6px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* 摘要 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {needsPush.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12,
            fontSize: '0.8rem', fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)',
          }}>
            ⬆ {needsPush.length} 个分支需要推送
          </span>
        )}
        {needsPull.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12,
            fontSize: '0.8rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#ef4444',
          }}>
            ⬇ {needsPull.length} 个分支需要拉取
          </span>
        )}
        {synced.length > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 12,
            fontSize: '0.8rem', fontWeight: 600, background: 'rgba(16,185,129,0.15)', color: '#10b981',
          }}>
            ✅ {synced.length} 个分支已同步
          </span>
        )}
      </div>

      {/* 分支列表 */}
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {syncData.branches.map(b => (
          <div key={b.name} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
            borderBottom: '1px solid var(--border-muted)', fontSize: '0.82rem',
          }}>
            <span style={{
              padding: '2px 8px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)',
              fontWeight: 600, fontSize: '0.8rem', flexShrink: 0,
            }}>
              {b.name}
            </span>
            <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              → {b.remote_branch}
            </span>
            {b.ahead > 0 && (
              <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)' }}>
                ⬆ {b.ahead}
              </span>
            )}
            {b.behind > 0 && (
              <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                ⬇ {b.behind}
              </span>
            )}
            {b.ahead === 0 && b.behind === 0 && (
              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>✓ 已同步</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}


export default function RemotePanel() {
  const { showToast } = useToast()
  const [remotes, setRemotes] = useState<RemoteInfo[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [remoteName, setRemoteName] = useState('origin')
  const [remoteUrl, setRemoteUrl] = useState('')

  // 一键上传
  const [pushAllMsg, setPushAllMsg] = useState('')
  const [pushAllRemote, setPushAllRemote] = useState('origin')
  const [pushAllBranch, setPushAllBranch] = useState('main')
  const [pushingAll, setPushingAll] = useState(false)

  // 多分支推送
  const [branchList, setBranchList] = useState<{ name: string; checked: boolean }[]>([])
  const [pushBranchesRemote, setPushBranchesRemote] = useState('origin')
  const [pushBranchesResult, setPushBranchesResult] = useState<string | null>(null)

  // 手动推送
  const [pushRemote, setPushRemote] = useState('origin')
  const [pushBranch, setPushBranch] = useState('')

  const loadRemoteInfo = useCallback(async () => {
    try {
      const data = await api.listRemotes()
      setRemotes(data.remotes || [])
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载远程仓库失败', 'error')
    }
  }, [showToast])

  useEffect(() => {
    loadRemoteInfo()
  }, [loadRemoteInfo])

  const handleAddRemote = useCallback(async () => {
    if (!remoteUrl.trim()) {
      showToast('请输入仓库 URL', 'error')
      return
    }
    try {
      await api.addRemote(remoteName.trim() || 'origin', remoteUrl.trim())
      showToast('远程仓库已设置', 'success')
      setShowAddForm(false)
      setRemoteUrl('')
      loadRemoteInfo()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '设置失败', 'error')
    }
  }, [remoteName, remoteUrl, showToast, loadRemoteInfo])

  // Fetch / Pull 分支选择
  const [pullRemoteName, setPullRemoteName] = useState('origin')
  const [pullBranchName, setPullBranchName] = useState('')
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const [pulling, setPulling] = useState(false)

  // NOTE: Fetch 预览结果
  interface FetchPreviewResult {
    current_branch: string
    behind: number
    ahead: number
    incoming_commits: { hash: string; author: string; date: string; message: string }[]
    message: string
  }
  const [fetchResult, setFetchResult] = useState<FetchPreviewResult | null>(null)

  const loadRemoteBranches = useCallback(async () => {
    try {
      const data = await api.getBranches()
      // NOTE: 只提取远程分支名（去掉 origin/ 前缀），当前分支排第一
      const currentBranch = data.current || ''
      const remote = (data.branches || [])
        .filter(b => b.remote && b.name.startsWith('origin/'))
        .map(b => b.name.replace('origin/', ''))
        .sort((a, b) => {
          if (a === currentBranch) return -1
          if (b === currentBranch) return 1
          return 0
        })
      setRemoteBranches(remote)
    } catch {
      // 静默失败
    }
  }, [])

  useEffect(() => {
    loadRemoteBranches()
  }, [loadRemoteBranches])

  const handleFetch = useCallback(async () => {
    setFetching(true)
    setFetchResult(null)
    try {
      // NOTE: 使用 fetch-preview 接口，获取 ahead/behind 和待合并提交列表
      const data = await api.fetchPreview()
      setFetchResult(data)
      if (data.behind === 0 && data.ahead === 0) {
        showToast('✅ 已是最新，没有新的远程更新', 'success')
      } else {
        showToast(`已获取远程更新：落后 ${data.behind} 个提交，领先 ${data.ahead} 个提交`, 'info')
      }
      loadRemoteBranches()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '获取失败', 'error')
    } finally {
      setFetching(false)
    }
  }, [showToast, loadRemoteBranches])

  const handlePull = useCallback(async () => {
    setPulling(true)
    try {
      await api.pullRemote(
        pullRemoteName || 'origin',
        pullBranchName || undefined
      )
      showToast(`✅ 拉取成功 - 已合并${pullBranchName ? ` ${pullRemoteName}/${pullBranchName}` : '远程更新'}到当前分支`, 'success')
      // NOTE: Pull 成功后清除 fetch 预览结果（已经合并了）
      setFetchResult(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '拉取失败', 'error')
    } finally {
      setPulling(false)
    }
  }, [pullRemoteName, pullBranchName, showToast])

  const handlePushAll = useCallback(async () => {
    if (!pushAllMsg.trim()) {
      showToast('请输入提交说明', 'error')
      return
    }
    setPushingAll(true)
    try {
      const data = await api.pushAll(pushAllMsg.trim(), pushAllRemote, pushAllBranch)
      showToast(data.message, 'success')
      setPushAllMsg('')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '上传失败', 'error')
    } finally {
      setPushingAll(false)
    }
  }, [pushAllMsg, pushAllRemote, pushAllBranch, showToast])

  const handlePush = useCallback(async () => {
    if (!pushBranch.trim()) {
      showToast('请输入远程分支名', 'error')
      return
    }
    try {
      await api.pushToRemote(pushRemote, pushBranch.trim())
      showToast(`已推送到 ${pushRemote}/${pushBranch}`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '推送失败', 'error')
    }
  }, [pushRemote, pushBranch, showToast])

  const loadBranchesForPush = useCallback(async () => {
    try {
      const data = await api.getBranches()
      setBranchList(
        (data.branches || [])
          .filter(b => !b.remote)
          .map(b => ({ name: b.name, checked: false }))
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载分支失败', 'error')
    }
  }, [showToast])

  const handlePushBranches = useCallback(async () => {
    const selected = branchList.filter(b => b.checked).map(b => b.name)
    if (selected.length === 0) {
      showToast('请至少选择一个分支', 'error')
      return
    }
    try {
      const data = await api.pushBranches(selected, pushBranchesRemote)
      showToast(data.message, data.success ? 'success' : 'error')
      setPushBranchesResult(
        data.results.map(r => `${r.branch}: ${r.success ? '✅ 成功' : '❌ ' + (r.error || '失败')}`).join('\n')
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : '推送失败', 'error')
    }
  }, [branchList, pushBranchesRemote, showToast])

  return (
    <div className="panel active" id="panel-remote">
      <div className="panel-header">
        <h1>远程同步 (GitHub)</h1>
        <div className="panel-actions">
          <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            添加远程仓库
          </button>
          <button className="btn btn-outline" onClick={loadRemoteInfo}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            刷新
          </button>
        </div>
      </div>
      <div className="panel-body">
        {/* 添加远程仓库表单 */}
        {showAddForm && (
          <div className="create-form">
            <div className="form-card">
              <h3>设置远程仓库</h3>
              <div className="input-group">
                <label>远程别名 (通常为 origin)</label>
                <input type="text" value={remoteName} onChange={e => setRemoteName(e.target.value)} placeholder="origin" />
              </div>
              <div className="input-group">
                <label>仓库 URL (HTTPS 或 SSH)</label>
                <input type="text" value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} placeholder="https://github.com/user/repo.git" />
              </div>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setShowAddForm(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleAddRemote}>保存</button>
              </div>
            </div>
          </div>
        )}

        {/* 远程仓库列表 */}
        <div className="info-card" style={{ marginTop: 0, marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: '1rem', color: 'var(--color-text)' }}>当前关联的远程仓库</h3>
          {remotes.length > 0 ? (
            remotes.map(r => (
              <div key={r.name} className="info-row">
                <span className="info-label">{r.name}</span>
                <span className="info-value">{r.url}</span>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ padding: 20 }}>
              <p>暂无数据或获取失败</p>
            </div>
          )}
        </div>

        {/* NOTE: 分支同步状态总览 —— 多人协作时一眼看出哪些分支需要推/拉 */}
        <SyncStatusOverview />

        <div className="section-divider"><span>代码推送与同步</span></div>

        {/* Fetch / Pull 操作区 */}
        <div className="form-card" style={{ marginTop: 16, marginBottom: 20, border: '1px solid var(--border-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)' }}>⬇️ 拉取远程代码</span>
          </div>

          {/* 概念说明 */}
          <div className="help-tip" style={{ marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <b>获取 (Fetch)</b> = 只下载远程更新到本地缓存，<b>不修改</b>你的代码文件，安全。
              <br />
              <b>拉取 (Pull)</b> = 下载 + <b>合并</b>到你当前的工作分支，会修改文件，可能产生冲突。
            </span>
          </div>

          {/* 分支选择 */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>远程名称</label>
              <input
                type="text"
                value={pullRemoteName}
                onChange={e => setPullRemoteName(e.target.value)}
                placeholder="origin"
              />
            </div>
            <div className="input-group" style={{ flex: 2, marginBottom: 0 }}>
              <label>远程分支（留空 = 拉取当前分支对应的远程）</label>
              <select
                value={pullBranchName}
                onChange={e => setPullBranchName(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">-- 当前分支对应的远程 --</option>
                {remoteBranches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-outline"
              onClick={handleFetch}
              disabled={fetching}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {fetching ? '获取中...' : '获取 (Fetch) - 只下载不合并'}
            </button>
            <button
              className="btn btn-primary"
              onClick={handlePull}
              disabled={pulling}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
              {pulling ? '拉取中...' : `拉取 (Pull) - 下载并合并${pullBranchName ? ` ${pullBranchName}` : ''}`}
            </button>
          </div>

          {/* Fetch 预览结果展示 */}
          {fetchResult && (
            <div style={{ marginTop: 14, padding: 14, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-muted)' }}>
              {/* 同步摘要 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: fetchResult.incoming_commits.length > 0 ? 12 : 0 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  📊 分支 <code style={{ background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-primary)' }}>{fetchResult.current_branch}</code> 同步状态：
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
                  background: fetchResult.behind > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                  color: fetchResult.behind > 0 ? '#ef4444' : '#10b981',
                }}>
                  {fetchResult.behind > 0 ? `⬇ 落后 ${fetchResult.behind} 个提交` : '✅ 已是最新'}
                </span>
                {fetchResult.ahead > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
                    background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)',
                  }}>
                    ⬆ 领先 {fetchResult.ahead} 个提交
                  </span>
                )}
              </div>

              {/* 待合并提交列表 */}
              {fetchResult.incoming_commits.length > 0 && (
                <>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    远程有 {fetchResult.incoming_commits.length} 个新提交等待合并（点击「拉取 Pull」合并到本地）：
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {fetchResult.incoming_commits.map((c, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
                        borderBottom: i < fetchResult.incoming_commits.length - 1 ? '1px solid var(--border-muted)' : 'none',
                        fontSize: '0.82rem',
                      }}>
                        <code style={{ flexShrink: 0, color: 'var(--color-primary)', background: 'var(--bg-card)', padding: '1px 5px', borderRadius: 4, fontSize: '0.78rem' }}>
                          {c.hash}
                        </code>
                        <span style={{ flex: 1, color: 'var(--color-text)' }}>{c.message}</span>
                        <span style={{ flexShrink: 0, color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                          {c.author} · {c.date.split(' ')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handlePull}
                    disabled={pulling}
                    style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
                  >
                    {pulling ? '合并中...' : `⬇ 拉取并合并这 ${fetchResult.behind} 个提交到本地`}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 一键全部上传 */}
        <div className="form-card" style={{ marginTop: 16, border: '1px solid var(--border-muted)', background: 'linear-gradient(135deg, rgba(46,160,67,0.08) 0%, var(--bg-card) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-primary)' }}>⬆️ 全部代码一键上传</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>自动 暂存 → 提交 → 推送</span>
          </div>
          <div className="input-group">
            <label>提交说明（必填）</label>
            <input type="text" placeholder="例如：feat: 更新功能代码" value={pushAllMsg} onChange={e => setPushAllMsg(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>推送到</label>
              <input type="text" value={pushAllRemote} onChange={e => setPushAllRemote(e.target.value)} placeholder="origin" />
            </div>
            <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>远程分支</label>
              <input type="text" value={pushAllBranch} onChange={e => setPushAllBranch(e.target.value)} placeholder="main" />
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: 14 }}>
            <button
              className="btn btn-primary"
              onClick={handlePushAll}
              disabled={pushingAll}
              style={{ width: '100%', justifyContent: 'center', background: 'var(--color-primary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {pushingAll ? '正在上传...' : '⬆️ 全部上传（暂存 + 提交 + 推送）'}
            </button>
          </div>
        </div>

        {/* 多选分支推送 */}
        <div className="form-card" style={{ marginTop: 16, border: '1px solid var(--border-muted)', background: 'linear-gradient(135deg, rgba(46,160,67,0.05) 0%, var(--bg-card) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
              <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-success)' }}>🌿 多选分支推送</span>
            <button className="btn btn-sm btn-ghost" onClick={loadBranchesForPush} title="刷新分支列表" style={{ marginLeft: 'auto', padding: '2px 6px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              刷新
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 36, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
            {branchList.length === 0 ? (
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>点击「刷新」加载本地分支列表...</span>
            ) : (
              branchList.map((b, i) => (
                <label key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: b.checked ? 'var(--color-primary-light, rgba(99,102,241,0.15))' : 'transparent', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={b.checked}
                    onChange={() => {
                      setBranchList(prev => prev.map((item, j) => j === i ? { ...item, checked: !item.checked } : item))
                    }}
                  />
                  {b.name}
                </label>
              ))
            )}
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label>推送到远程别名</label>
            <input type="text" value={pushBranchesRemote} onChange={e => setPushBranchesRemote(e.target.value)} placeholder="origin" />
          </div>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-outline" onClick={() => setBranchList(prev => prev.map(b => ({ ...b, checked: true })))} style={{ flex: 1 }}>全选</button>
            <button className="btn btn-primary" onClick={handlePushBranches} style={{ flex: 2, justifyContent: 'center', background: 'var(--color-success)' }}>
              🌿 推送选中的分支
            </button>
          </div>
          {pushBranchesResult && (
            <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', whiteSpace: 'pre-line' }}>
              {pushBranchesResult}
            </div>
          )}
        </div>

        {/* 手动推送 */}
        <div className="section-divider" style={{ marginTop: 20 }}><span>手动分步推送</span></div>
        <div className="form-card" style={{ marginTop: 16 }}>
          <div className="input-group">
            <label>推送到远程别名</label>
            <input type="text" value={pushRemote} onChange={e => setPushRemote(e.target.value)} placeholder="例如：origin" />
          </div>
          <div className="input-group">
            <label>推送到远程分支名</label>
            <input type="text" value={pushBranch} onChange={e => setPushBranch(e.target.value)} placeholder="例如：main 或 master" />
          </div>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handlePush} style={{ width: '100%', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              开始推送 (Push)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
