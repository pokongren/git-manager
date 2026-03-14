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
                  <span className="tree-hash">{treeData.main_commits[0].short_hash}</span>
                  <span className="tree-msg">{treeData.main_commits[0].message}</span>
                </div>
                <div className="tree-head-actions">
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
                    <div className="b-meta">
                      {branch.ahead > 0 && <span className="b-stat ahead">↑ 领先 {branch.ahead} 个提交</span>}
                      {branch.behind > 0 && <span className="b-stat behind">↓ 落后 {branch.behind} 个提交</span>}
                    </div>
                    <div className="b-actions">
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
      </div>
    </div>
  )
}
