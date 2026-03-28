import { useState, useCallback } from 'react'
import * as api from '../../api'
import type { BranchTreeData } from '../../api'
import { useToast } from '../../hooks/useToast'
import { formatShortDate } from '../../utils'

export default function BranchPanel() {
  const { showToast } = useToast()
  const [treeData, setTreeData] = useState<BranchTreeData | null>(null)
  const [backupCount, setBackupCount] = useState(0)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchSource, setNewBranchSource] = useState('')
  const [showRemoteBranches, setShowRemoteBranches] = useState(true)

  const loadBranchTree = useCallback(async () => {
    try {
      const [data, tagData] = await Promise.all([
        api.getBranchTree(),
        api.getTags().catch(() => ({ tags: [] })),
      ])
      setTreeData(data)
      setBackupCount(tagData.tags?.length ?? 0)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载分支树失败', 'error')
    }
  }, [showToast])

  // 首次加载
  useState(() => { loadBranchTree() })

  const handleCreateBranch = useCallback(async () => {
    if (!newBranchName.trim()) {
      showToast('请输入分支名称', 'error')
      return
    }
    try {
      await api.createBranch(newBranchName.trim(), newBranchSource || undefined)
      showToast(`分支 '${newBranchName}' 已创建并切换`, 'success')
      setShowCreateForm(false)
      setNewBranchName('')
      setNewBranchSource('')
      loadBranchTree()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '创建失败', 'error')
    }
  }, [newBranchName, newBranchSource, showToast, loadBranchTree])

  const handleSwitch = useCallback(async (name: string) => {
    try {
      await api.switchBranch(name)
      showToast(`已切换到分支 '${name}'`, 'success')
      loadBranchTree()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '切换失败', 'error')
    }
  }, [showToast, loadBranchTree])

  const handleDelete = useCallback(async (name: string) => {
    if (!confirm(`确定要删除分支 '${name}' 吗？`)) return
    try {
      await api.deleteBranch(name)
      showToast(`分支 '${name}' 已删除`, 'success')
      loadBranchTree()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除失败', 'error')
    }
  }, [showToast, loadBranchTree])

  const handleMerge = useCallback(async (name: string) => {
    try {
      await api.mergeBranch(name)
      showToast(`分支 '${name}' 已合并到当前分支`, 'success')
      loadBranchTree()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '合并失败', 'error')
    }
  }, [showToast, loadBranchTree])

  // NOTE: 检出远程分支 —— 从远程分支创建对应的本地分支并切换
  const handleCheckoutRemote = useCallback(async (remoteName: string, localName: string) => {
    try {
      await api.createBranch(localName, remoteName)
      showToast(`已从 '${remoteName}' 检出本地分支 '${localName}'`, 'success')
      loadBranchTree()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '检出失败', 'error')
    }
  }, [showToast, loadBranchTree])

  // NOTE: 推送到远程仓库
  const handlePushToRemote = useCallback(async (branchName: string) => {
    try {
      showToast(`开始推送分支 '${branchName}'...`, 'info')
      await api.pushToRemote('origin', branchName)
      showToast(`分支 '${branchName}' 推送成功`, 'success')
      // 可选：重新加载状态以便更新 local/remote 领先落后数字
      loadBranchTree()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '推送失败', 'error')
    }
  }, [showToast, loadBranchTree])

  return (
    <div className="panel active" id="panel-branches">
      <div className="panel-header">
        <h1>分支管理</h1>
        <div className="panel-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建分支
          </button>
          <button className="btn btn-outline" onClick={loadBranchTree}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            刷新
          </button>
        </div>
      </div>
      <div className="panel-body">
        {/* 新建分支表单 */}
        {showCreateForm && (
          <div className="create-form">
            <div className="form-card">
              <h3>创建新分支</h3>
              <div className="input-group">
                <label>分支名称</label>
                <input
                  type="text"
                  placeholder="feature/my-feature"
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateBranch() }}
                />
              </div>
              <div className="input-group">
                <label>基于分支（可选）</label>
                <select value={newBranchSource} onChange={e => setNewBranchSource(e.target.value)}>
                  <option value="">默认基于当前分支</option>
                  {treeData?.branches.map(b => (
                    <option key={b.name} value={b.name}>{b.name}</option>
                  ))}
                  {treeData?.main_branch && (
                    <option value={treeData.main_branch}>{treeData.main_branch}</option>
                  )}
                </select>
              </div>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setShowCreateForm(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleCreateBranch}>创建</button>
              </div>
            </div>
          </div>
        )}

        {/* 分支树 */}
        {treeData && treeData.main_commits.length > 0 ? (
          <div className="tree-trunk">
            {/* 主干头部 */}
            <div className="tree-node tree-head-node">
              <div className={`tree-head ${treeData.current_branch === treeData.main_branch ? 'is-current' : ''}`}>
                <div className="tree-head-main">
                  <span className="tree-badge">{treeData.main_branch}</span>
                  {treeData.current_branch === treeData.main_branch && <span className="tree-status">● 当前</span>}
                  {treeData.main_branch_size && <span className="tree-status" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-success)' }}>📦 {treeData.main_branch_size}</span>}
                  <span className="tree-hash">{treeData.main_commits[0].short_hash}</span>
                  <span className="tree-msg">{treeData.main_commits[0].message}</span>
                </div>
                <div className="tree-head-actions">
                  <button className="btn btn-sm btn-outline backup-shortcut" title="推送到 origin 远程仓库" onClick={() => handlePushToRemote(treeData.main_branch)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    推送
                  </button>
                  {backupCount > 0 && (
                    <button className="btn btn-sm btn-outline backup-shortcut" title="查看备份还原点">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                      </svg>
                      ⏱ {backupCount} 个备份点
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 分支节点 - 当前分支置顶 */}
            {[...treeData.branches].sort((a, b) => {
              if (a.current) return -1
              if (b.current) return 1
              return 0
            }).map((branch, idx) => (
              <div key={branch.name} className="tree-node is-branch">
                <div className="tree-branch" data-color={idx % 6}>
                  <div className={`branch-card ${branch.current ? 'is-current' : ''}`}>
                    <div className="b-header">
                      <span className="b-name">
                        {branch.name}
                        {branch.current && <span style={{ color: 'var(--color-success)' }}> ● 当前</span>}
                      </span>
                      <span className="b-meta">
                        <span>{branch.hash}</span>
                        {branch.message && <span> — {branch.message}</span>}
                      </span>
                    </div>
                    {/* NOTE: 分支元信息行 —— 多人协作时展示作者和时间 */}
                    <div className="b-meta" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {branch.size && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          📦 {branch.size}
                        </span>
                      )}
                      {branch.author && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          👤 {branch.author}
                        </span>
                      )}
                      {branch.date && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                          🕐 {branch.date}
                        </span>
                      )}
                      {branch.ahead > 0 && <span className="b-stat ahead">↑ 领先 {branch.ahead} 个提交</span>}
                      {branch.behind > 0 && <span className="b-stat behind">↓ 落后 {branch.behind} 个提交</span>}
                    </div>
                    {branch.description && (
                      <div className="b-description">
                        <span className="b-desc-icon">📝</span>
                        <span>{branch.description}</span>
                      </div>
                    )}
                    {branch.diff_summary && (
                      <div className="b-diff-summary">
                        <span className="b-desc-icon">📊</span>
                        <span>{branch.diff_summary}</span>
                      </div>
                    )}
                    <div className="b-actions">
                      <button className="btn btn-sm btn-outline" onClick={() => handlePushToRemote(branch.name)} title="推送到 origin 远程仓库">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        推送
                      </button>
                      {!branch.current && (
                        <>
                          <button className="btn btn-sm btn-outline" onClick={() => handleSwitch(branch.name)}>切换</button>
                          <button className="btn btn-sm btn-outline" onClick={() => handleMerge(branch.name)}>
                            合并到 {treeData.main_branch}
                          </button>
                        </>
                      )}
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(branch.name)} title="删除分支">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* 主干提交列表 */}
            {treeData.main_commits.slice(1).map(commit => (
              <div key={commit.hash} className="tree-node">
                <div className="tree-commit">
                  <span className="commit-hash">{commit.short_hash}</span>
                  <span className="commit-msg">{commit.message}</span>
                  <span className="commit-date">{formatShortDate(commit.date)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>暂无提交记录</h3>
            <p>该仓库还没有任何提交</p>
          </div>
        )}

        {/* 远程分支列表 */}
        {treeData && treeData.remote_branches && treeData.remote_branches.length > 0 && (
          <div className="form-card" style={{ marginTop: 20, border: '1px solid var(--border-muted)' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowRemoteBranches(prev => !prev)}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"
                style={{ transform: showRemoteBranches ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
                <path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
              </svg>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)' }}>
                远程分支
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '1px 8px',
                borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                background: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)',
              }}>
                {treeData.remote_branches.length}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                执行 Fetch 获取最新远程分支
              </span>
            </div>

            {showRemoteBranches && (
              <div style={{ marginTop: 12 }}>
                {treeData.remote_branches.map(rb => (
                  <div
                    key={rb.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderBottom: '1px solid var(--border-muted)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {/* 分支名 */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: rb.has_local ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                      color: rb.has_local ? 'var(--color-success)' : 'var(--color-primary)',
                      fontWeight: 600, fontSize: '0.82rem', flexShrink: 0,
                    }}>
                      {rb.name}
                    </span>
                    {/* 短 hash */}
                    <code style={{
                      flexShrink: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)',
                      background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 4,
                    }}>
                      {rb.hash}
                    </code>
                    {/* 提交信息 */}
                    <span style={{ flex: 1, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rb.message}
                    </span>
                    {/* 时间 */}
                    <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      {rb.date}
                    </span>
                    {/* 大小 */}
                    {rb.size && (
                      <span style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        📦 {rb.size}
                      </span>
                    )}
                    {/* 操作 */}
                    {rb.has_local ? (
                      <span style={{
                        flexShrink: 0, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10,
                        background: 'rgba(16,185,129,0.1)', color: 'var(--color-success)', fontWeight: 500,
                      }}>
                        ✓ 已检出
                      </span>
                    ) : (
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ flexShrink: 0 }}
                        onClick={() => handleCheckoutRemote(rb.name, rb.local_name)}
                      >
                        检出
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
