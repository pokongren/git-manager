import { useState, useEffect, useCallback } from 'react'
import * as api from '../../api'
import type { StatusFile } from '../../api'
import { useToast } from '../../hooks/useToast'

/**
 * 远程同步快速提示栏
 * NOTE: 在仓库状态面板顶部显示当前分支的同步状态，避免频繁切换页面
 */
function SyncQuickBar() {
  const { showToast } = useToast()
  const [syncInfo, setSyncInfo] = useState<{ ahead: number; behind: number; branch: string } | null>(null)
  const [pulling, setPulling] = useState(false)
  const [pushing, setPushing] = useState(false)

  const loadSync = useCallback(async () => {
    try {
      const data = await api.getSyncStatus()
      if (data.branches && data.branches.length > 0) {
        // NOTE: 找到当前分支（通常排第一）
        const repoInfo = await api.getRepoInfo()
        const currentBranch = repoInfo.current_branch || ''
        const match = data.branches.find(b => b.name === currentBranch) || data.branches[0]
        setSyncInfo({ ahead: match.ahead, behind: match.behind, branch: match.name })
      }
    } catch {
      // 静默失败
    }
  }, [])

  useEffect(() => {
    loadSync()
  }, [loadSync])

  if (!syncInfo || (syncInfo.ahead === 0 && syncInfo.behind === 0)) return null

  const handleQuickPull = async () => {
    setPulling(true)
    try {
      await api.pullRemote()
      showToast('拉取成功', 'success')
      loadSync()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '拉取失败', 'error')
    } finally {
      setPulling(false)
    }
  }

  const handleQuickPush = async () => {
    setPushing(true)
    try {
      await api.pushToRemote('origin', syncInfo.branch)
      showToast('推送成功', 'success')
      loadSync()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '推送失败', 'error')
    } finally {
      setPushing(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 16,
      background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-muted)',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
        <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
        <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
      </svg>
      <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
        <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 4, color: 'var(--color-primary)', fontSize: '0.82rem' }}>
          {syncInfo.branch}
        </code>
      </span>
      {syncInfo.behind > 0 && (
        <>
          <span style={{
            padding: '2px 8px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 600,
            background: 'rgba(239,68,68,0.15)', color: '#ef4444',
          }}>
            ⬇ 落后 {syncInfo.behind}
          </span>
          <button className="btn btn-sm btn-outline" onClick={handleQuickPull} disabled={pulling} style={{ fontSize: '0.78rem', padding: '2px 8px' }}>
            {pulling ? '拉取中...' : '快速拉取'}
          </button>
        </>
      )}
      {syncInfo.ahead > 0 && (
        <>
          <span style={{
            padding: '2px 8px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 600,
            background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)',
          }}>
            ⬆ 领先 {syncInfo.ahead}
          </span>
          <button className="btn btn-sm btn-outline" onClick={handleQuickPush} disabled={pushing} style={{ fontSize: '0.78rem', padding: '2px 8px' }}>
            {pushing ? '推送中...' : '快速推送'}
          </button>
        </>
      )}
    </div>
  )
}

interface StatusPanelProps {
  onRefreshRepo: () => void
  onShowDiff: (filepath: string) => void
}

interface FileItem extends StatusFile {
  selected: boolean
  statusText: string
}

function getStatusClass(statusText: string): string {
  if (statusText.includes('修改')) return 'modified'
  if (statusText.includes('新增')) return 'added'
  if (statusText.includes('删除')) return 'deleted'
  return 'untracked'
}

export default function StatusPanel({ onRefreshRepo, onShowDiff }: StatusPanelProps) {
  const { showToast } = useToast()
  const [files, setFiles] = useState<FileItem[]>([])
  const [clean, setClean] = useState(true)
  const [isMerging, setIsMerging] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [commitType, setCommitType] = useState('')

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.getStatus()
      setClean(data.clean)
      setIsMerging(data.is_merging)

      if (!data.clean) {
        setFiles(
          data.files.map(f => ({
            ...f,
            selected: false,
            statusText: f.working || f.index || '未知',
          }))
        )
      } else {
        setFiles([])
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载状态失败', 'error')
    }
  }, [showToast])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const toggleSelect = (index: number) => {
    setFiles(prev =>
      prev.map((f, i) => (i === index ? { ...f, selected: !f.selected } : f))
    )
  }

  const toggleSelectAll = () => {
    const allSelected = files.every(f => f.selected)
    setFiles(prev => prev.map(f => ({ ...f, selected: !allSelected })))
  }

  const selectedCount = files.filter(f => f.selected).length

  const handleStageSelected = useCallback(async () => {
    const selectedFiles = files.filter(f => f.selected).map(f => f.path)
    if (selectedFiles.length === 0) {
      showToast('请先勾选要暂存的文件', 'error')
      return
    }
    try {
      await api.stageFiles(selectedFiles)
      showToast(`已暂存 ${selectedFiles.length} 个文件`, 'success')
      loadStatus()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '暂存失败', 'error')
    }
  }, [files, showToast, loadStatus])

  const handleStageAll = useCallback(async () => {
    try {
      await api.stageFiles()
      showToast('所有文件已暂存', 'success')
      loadStatus()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '暂存失败', 'error')
    }
  }, [showToast, loadStatus])

  const handleUnstageAll = useCallback(async () => {
    try {
      await api.unstageFiles()
      showToast('已撤销全部暂存', 'success')
      loadStatus()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败', 'error')
    }
  }, [showToast, loadStatus])

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) {
      showToast('请输入提交信息', 'error')
      return
    }
    try {
      await api.commitChanges(commitMsg)
      showToast('提交成功', 'success')
      setCommitMsg('')
      setCommitType('')
      loadStatus()
      onRefreshRepo()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '提交失败', 'error')
    }
  }, [commitMsg, showToast, loadStatus, onRefreshRepo])

  const handleAbortMerge = useCallback(async () => {
    try {
      await api.abortMerge()
      showToast('合并已中止', 'success')
      loadStatus()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败', 'error')
    }
  }, [showToast, loadStatus])

  const applyCommitType = (prefix: string) => {
    setCommitType(prefix)
    if (!prefix) return
    // 移除已有的类型前缀
    const knownPrefixes = ['feat: ', 'fix: ', 'docs: ', 'style: ', 'refactor: ', 'perf: ', 'chore: ', 'data: ']
    let msg = commitMsg
    for (const p of knownPrefixes) {
      if (msg.startsWith(p)) {
        msg = msg.substring(p.length)
        break
      }
    }
    setCommitMsg(prefix + msg)
  }

  // 统计
  const statCounts = files.reduce<Record<string, number>>((acc, f) => {
    const cls = getStatusClass(f.statusText)
    acc[cls] = (acc[cls] || 0) + 1
    return acc
  }, {})
  const statLabels: Record<string, string> = { modified: '已修改', added: '新增', deleted: '已删除', untracked: '未跟踪' }

  return (
    <div className="panel active" id="panel-status">
      <div className="panel-header">
        <h1>仓库状态</h1>
        <div className="panel-actions">
          <button className="btn btn-outline" onClick={loadStatus}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            刷新
          </button>
        </div>
      </div>
      <div className="panel-body">
        {/* NOTE: 远程同步快速提示栏 —— 多人协作时随时了解同步状态 */}
        <SyncQuickBar />
        {/* 操作说明 */}
        {!clean && (
          <div className="help-tip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span><b>操作说明：</b>勾选要保存的文件 → 点击"暂存选中" → 输入提交信息 → 点击"提交"。未勾选的文件不会被保存。</span>
          </div>
        )}

        {/* 冲突警告 */}
        {isMerging && (
          <div className="conflict-warning" style={{ display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="conflict-msg">
              <strong>存在文件冲突</strong>
              <p>拉取或合并发生了冲突。请在编辑器中解决标红文件的冲突，然后暂存并提交；或者中止当前合并。</p>
            </div>
            <button className="btn btn-sm btn-danger" onClick={handleAbortMerge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              中止合并 (Abort)
            </button>
          </div>
        )}

        {/* 工作区干净 */}
        {clean && (
          <div className="empty-state" style={{ display: 'flex' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h3>工作区干净</h3>
            <p>没有需要提交的更改，所有文件已是最新状态</p>
          </div>
        )}

        {/* 文件列表 */}
        {!clean && (
          <div>
            {/* 文件统计 */}
            <div className="status-stats">
              {Object.entries(statCounts)
                .filter(([, count]) => count > 0)
                .map(([type, count]) => (
                  <span key={type} className={`stat-item ${type}`}>
                    {statLabels[type]} {count} 个文件
                  </span>
                ))}
              <span className="stat-item" style={{ background: 'var(--bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                共 {files.length} 个变更
              </span>
            </div>

            {/* 工具栏 */}
            <div className="status-toolbar">
              <div className="toolbar-left">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={files.length > 0 && files.every(f => f.selected)}
                    ref={el => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < files.length }}
                    onChange={toggleSelectAll}
                  />
                  <span>全选</span>
                </label>
                <button className="btn btn-sm btn-outline" onClick={handleStageSelected}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  暂存选中 ({selectedCount})
                </button>
                <button className="btn btn-sm btn-outline" onClick={handleStageAll}>全部暂存</button>
                <button className="btn btn-sm btn-ghost" onClick={handleUnstageAll} title="撤销全部暂存">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  撤销暂存
                </button>
              </div>
              <div className="commit-inline">
                <select
                  value={commitType}
                  onChange={e => applyCommitType(e.target.value)}
                  title="选择提交类型"
                >
                  <option value="">类型</option>
                  <option value="feat: ">✨ 新功能</option>
                  <option value="fix: ">🐛 修复</option>
                  <option value="docs: ">📝 文档</option>
                  <option value="style: ">💄 样式</option>
                  <option value="refactor: ">♻️ 重构</option>
                  <option value="perf: ">⚡ 性能</option>
                  <option value="chore: ">🔧 杂项</option>
                  <option value="data: ">📊 数据更新</option>
                </select>
                <input
                  type="text"
                  placeholder="输入提交信息..."
                  value={commitMsg}
                  onChange={e => setCommitMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCommit() }}
                />
                <button className="btn btn-sm btn-primary" onClick={handleCommit}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  提交
                </button>
              </div>
            </div>

            {/* 文件列表 */}
            <div className="file-list">
              {files.map((file, i) => (
                <div
                  key={file.path}
                  className={`file-item ${file.selected ? 'selected' : ''}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                  onClick={() => toggleSelect(i)}
                >
                  <input
                    type="checkbox"
                    checked={file.selected}
                    onChange={() => toggleSelect(i)}
                    onClick={e => e.stopPropagation()}
                  />
                  <span className={`file-status ${getStatusClass(file.statusText)}`}>{file.statusText}</span>
                  <span className="file-path">{file.path}</span>
                  <button
                    className="btn btn-sm btn-ghost file-diff-btn"
                    onClick={e => { e.stopPropagation(); onShowDiff(file.path) }}
                    title="查看 Diff"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
