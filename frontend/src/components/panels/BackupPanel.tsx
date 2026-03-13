import { useState, useCallback, useEffect } from 'react'
import * as api from '../../api'
import type { TagInfo, StashInfo } from '../../api'
import { useToast } from '../../hooks/useToast'
import { formatDate } from '../../utils'

export default function BackupPanel() {
  const { showToast } = useToast()
  const [tags, setTags] = useState<TagInfo[]>([])
  const [stashes, setStashes] = useState<StashInfo[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagMessage, setTagMessage] = useState('')

  const loadTags = useCallback(async () => {
    try {
      const data = await api.getTags()
      setTags(data.tags || [])
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载备份失败', 'error')
    }
  }, [showToast])

  const loadStashes = useCallback(async () => {
    try {
      const data = await api.getStashes()
      setStashes(data.stashes || [])
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载 Stash 失败', 'error')
    }
  }, [showToast])

  useEffect(() => {
    loadTags()
    loadStashes()
  }, [loadTags, loadStashes])

  const handleCreateBackup = useCallback(async () => {
    if (!tagName.trim()) {
      showToast('请输入备份标签名', 'error')
      return
    }
    try {
      await api.createBackup(tagName.trim(), tagMessage || undefined)
      showToast('备份创建成功', 'success')
      setShowCreateForm(false)
      setTagName('')
      setTagMessage('')
      loadTags()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '创建备份失败', 'error')
    }
  }, [tagName, tagMessage, showToast, loadTags])

  const handleRestore = useCallback(async (target: string) => {
    if (!confirm(`确定要还原到 '${target}' 吗？这将覆盖当前的工作区。`)) return
    try {
      await api.restoreToTag(target)
      showToast(`已还原到 '${target}'`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '还原失败', 'error')
    }
  }, [showToast])

  const handleDeleteTag = useCallback(async (name: string) => {
    if (!confirm(`确定要删除备份点 '${name}' 吗？`)) return
    try {
      await api.deleteTag(name)
      showToast(`备份点 '${name}' 已删除`, 'success')
      loadTags()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除失败', 'error')
    }
  }, [showToast, loadTags])

  const handleStashSave = useCallback(async () => {
    try {
      await api.stashSave()
      showToast('已暂存当前更改', 'success')
      loadStashes()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '暂存失败', 'error')
    }
  }, [showToast, loadStashes])

  const handleStashPop = useCallback(async () => {
    try {
      await api.stashPop()
      showToast('已恢复暂存', 'success')
      loadStashes()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '恢复失败', 'error')
    }
  }, [showToast, loadStashes])

  const handleStashDrop = useCallback(async (index: number) => {
    try {
      await api.stashDrop(index)
      showToast('已丢弃暂存', 'success')
      loadStashes()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败', 'error')
    }
  }, [showToast, loadStashes])

  return (
    <div className="panel active" id="panel-backup">
      <div className="panel-header">
        <h1>备份与还原</h1>
        <div className="panel-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            创建备份
          </button>
          <button className="btn btn-outline" onClick={() => { loadTags(); loadStashes() }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            刷新
          </button>
        </div>
      </div>
      <div className="panel-body">
        {/* 创建备份表单 */}
        {showCreateForm && (
          <div className="create-form">
            <div className="form-card">
              <h3>创建备份点</h3>
              <div className="input-group">
                <label>备份标签名</label>
                <input
                  type="text"
                  placeholder="backup-v1.0"
                  value={tagName}
                  onChange={e => setTagName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>备份说明（可选）</label>
                <input
                  type="text"
                  placeholder="描述此备份点..."
                  value={tagMessage}
                  onChange={e => setTagMessage(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setShowCreateForm(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleCreateBackup}>创建</button>
              </div>
            </div>
          </div>
        )}

        {/* 备份列表 */}
        {tags.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="1.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <h3>暂无备份点</h3>
            <p>点击"创建备份"来保存当前状态</p>
          </div>
        ) : (
          <div className="tag-list">
            {tags.map(tag => (
              <div key={tag.name} className="tag-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-muted)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{tag.name}</div>
                  {tag.message && <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{tag.message}</div>}
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: 2 }}>{formatDate(tag.date)} · {tag.hash}</div>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => handleRestore(tag.name)}>还原</button>
                <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteTag(tag.name)} title="删除">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Stash 区 */}
        <div className="section-divider"><span>Stash 暂存区</span></div>
        <div className="stash-toolbar">
          <button className="btn btn-sm btn-outline" onClick={handleStashSave}>暂存当前更改</button>
          <button className="btn btn-sm btn-outline" onClick={handleStashPop}>恢复暂存</button>
          <button className="btn btn-sm btn-outline" onClick={loadStashes}>刷新</button>
        </div>
        <div className="stash-list">
          {stashes.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
              暂无 Stash 记录
            </div>
          ) : (
            stashes.map(s => (
              <div key={s.index} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-muted)' }}>
                <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>stash@{'{' + s.index + '}'}</span>
                <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{s.message}</span>
                <button className="btn btn-sm btn-ghost" onClick={() => handleStashDrop(s.index)} title="丢弃">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
