import { useState, useCallback, useEffect } from 'react'
import * as api from '../../api'
import type { TagInfo, StashInfo, FileTypeGroup } from '../../api'
import { useToast } from '../../hooks/useToast'
import { formatDate } from '../../utils'

export default function BackupPanel() {
  const { showToast } = useToast()
  const [tags, setTags] = useState<TagInfo[]>([])
  const [stashes, setStashes] = useState<StashInfo[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagMessage, setTagMessage] = useState('')

  // NOTE: 文件类型管理状态
  const [showFileTypes, setShowFileTypes] = useState(false)
  const [fileTypeGroups, setFileTypeGroups] = useState<FileTypeGroup[]>([])
  const [ignoredGroups, setIgnoredGroups] = useState<Set<string>>(new Set())
  const [fileTypesLoading, setFileTypesLoading] = useState(false)
  const [fileTypesDirty, setFileTypesDirty] = useState(false)
  const [saving, setSaving] = useState(false)

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

  // NOTE: 加载文件类型管理数据
  const loadFileTypes = useCallback(async () => {
    setFileTypesLoading(true)
    try {
      const data = await api.getFileTypes()
      setFileTypeGroups(data.groups)
      // 初始化已忽略的分组集合
      const ignored = new Set<string>()
      data.groups.forEach(g => {
        if (g.is_ignored) ignored.add(g.id)
      })
      setIgnoredGroups(ignored)
      setFileTypesDirty(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载文件类型失败', 'error')
    } finally {
      setFileTypesLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadTags()
    loadStashes()
  }, [loadTags, loadStashes])

  // NOTE: 展开文件类型管理时才加载数据
  useEffect(() => {
    if (showFileTypes && fileTypeGroups.length === 0) {
      loadFileTypes()
    }
  }, [showFileTypes, fileTypeGroups.length, loadFileTypes])

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

  // NOTE: 切换某个分组的忽略状态
  const handleToggleGroup = useCallback((groupId: string) => {
    setIgnoredGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
    setFileTypesDirty(true)
  }, [])

  // NOTE: 保存文件类型配置到 .gitignore
  const handleSaveFileTypes = useCallback(async () => {
    setSaving(true)
    try {
      const result = await api.updateGitignore(Array.from(ignoredGroups))
      showToast(result.message, 'success')
      setFileTypesDirty(false)
      // 重新加载以获取最新状态
      loadFileTypes()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }, [ignoredGroups, showToast, loadFileTypes])

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

        {/* NOTE: 文件类型管理区域 */}
        <div className="form-card" style={{ marginBottom: 16, border: '1px solid var(--border-muted)' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setShowFileTypes(prev => !prev)}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"
              style={{ transform: showFileTypes ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)' }}>
              备份文件类型管理
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
              选择哪些文件类型参与备份
            </span>
          </div>

          {showFileTypes && (
            <div style={{ marginTop: 16 }}>
              {fileTypesLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  正在扫描仓库文件类型...
                </div>
              ) : (
                <>
                  {/* 提示说明 */}
                  <div style={{
                    padding: '10px 14px', marginBottom: 14, borderRadius: 'var(--radius-sm)',
                    background: 'rgba(99,102,241,0.08)', fontSize: '0.8rem', color: 'var(--color-text-secondary)',
                    lineHeight: 1.6,
                  }}>
                    💡 <strong>绿色 = 已备份</strong>（文件会被 Git 跟踪）&nbsp;&nbsp;
                    <strong>灰色 = 已排除</strong>（文件被 .gitignore 忽略）。
                    切换开关后点击保存生效。
                  </div>

                  {/* 文件类型分组列表 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {fileTypeGroups.map(group => {
                      const isIgnored = ignoredGroups.has(group.id)
                      return (
                        <div
                          key={group.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                            background: isIgnored ? 'rgba(100,116,139,0.06)' : 'rgba(16,185,129,0.06)',
                            border: `1px solid ${isIgnored ? 'var(--border-muted)' : 'rgba(16,185,129,0.2)'}`,
                            transition: 'all 0.2s',
                          }}
                        >
                          {/* 图标 */}
                          <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{group.icon}</span>

                          {/* 信息区 */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                {group.name}
                              </span>
                              {group.file_count > 0 && (
                                <span style={{
                                  fontSize: '0.73rem', padding: '1px 7px', borderRadius: 8,
                                  background: group.total_size_bytes > 10 * 1024 * 1024
                                    ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.1)',
                                  color: group.total_size_bytes > 10 * 1024 * 1024
                                    ? 'var(--color-danger)' : 'var(--color-primary)',
                                  fontWeight: 500,
                                }}>
                                  {group.file_count} 个文件 · {group.total_size}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.77rem', color: 'var(--color-text-secondary)', marginTop: 3 }}>
                              {group.description}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: 2 }}>
                              {group.patterns.join('  ')}
                            </div>
                          </div>

                          {/* 开关按钮 */}
                          <button
                            onClick={() => handleToggleGroup(group.id)}
                            style={{
                              flexShrink: 0, width: 52, height: 28, borderRadius: 14,
                              border: 'none', cursor: 'pointer', position: 'relative',
                              background: isIgnored
                                ? 'rgba(100,116,139,0.25)'
                                : 'var(--color-success)',
                              transition: 'background 0.25s',
                            }}
                            title={isIgnored ? '点击开启备份（取消忽略）' : '点击排除备份（添加忽略）'}
                          >
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: '#fff', position: 'absolute', top: 3,
                              left: isIgnored ? 3 : 27,
                              transition: 'left 0.25s',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }} />
                            <span style={{
                              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                              fontSize: '0.65rem', fontWeight: 600, color: '#fff',
                              left: isIgnored ? 28 : 7,
                            }}>
                              {isIgnored ? '排除' : '备份'}
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {/* 保存按钮 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    <button
                      className={`btn ${fileTypesDirty ? 'btn-primary' : 'btn-outline'}`}
                      onClick={handleSaveFileTypes}
                      disabled={!fileTypesDirty || saving}
                      style={{ marginRight: 'auto' }}
                    >
                      {saving ? '保存中...' : fileTypesDirty ? '💾 保存配置' : '✓ 已同步'}
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={loadFileTypes} disabled={fileTypesLoading}>
                      刷新
                    </button>
                    {fileTypesDirty && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-warning)' }}>
                        ⚠ 有未保存的更改
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

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
