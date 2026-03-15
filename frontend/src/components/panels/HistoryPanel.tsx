import { useState, useCallback, useEffect, useMemo } from 'react'
import * as api from '../../api'
import type { CommitInfo } from '../../api'
import { useToast } from '../../hooks/useToast'
import { formatDate } from '../../utils'

interface HistoryPanelProps {
  onShowCommitDiff: (hash: string, message: string) => void
}

/**
 * 根据作者名生成稳定的 HSL 颜色
 * NOTE: 不同作者产生不同色调，便于一眼区分团队成员
 */
function authorColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 55%)`
}

/**
 * 获取作者名的首字母（支持中英文）
 */
function authorInitial(name: string): string {
  if (!name) return '?'
  const trimmed = name.trim()
  // 中文直接取第一个字
  if (/[\u4e00-\u9fff]/.test(trimmed[0])) return trimmed[0]
  // 英文取首字母大写
  return trimmed[0].toUpperCase()
}

export default function HistoryPanel({ onShowCommitDiff }: HistoryPanelProps) {
  const { showToast } = useToast()
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.getHistory()
      setCommits(data.commits || [])
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载历史失败', 'error')
    }
  }, [showToast])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // NOTE: 提取所有不重复的作者列表，用于筛选下拉
  const authors = useMemo(() => {
    const set = new Set<string>()
    commits.forEach(c => { if (c.author) set.add(c.author) })
    return Array.from(set).sort()
  }, [commits])

  // 搜索 + 作者筛选
  const filteredCommits = commits.filter(c => {
    if (authorFilter && c.author !== authorFilter) return false
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.message.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q) ||
      c.short_hash.toLowerCase().includes(q) ||
      c.hash.toLowerCase().includes(q)
    )
  })

  return (
    <div className="panel active" id="panel-history">
      <div className="panel-header">
        <h1>提交历史</h1>
        <div className="panel-actions">
          <button className="btn btn-outline" onClick={loadHistory}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            刷新
          </button>
        </div>
      </div>
      <div className="panel-body">
        {/* 搜索 + 按作者筛选 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div className="history-search" style={{ flex: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="搜索提交信息、作者或哈希..."
              spellCheck={false}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* NOTE: 按作者筛选 —— 多人协作时快速查看某人的提交 */}
          {authors.length > 1 && (
            <select
              value={authorFilter}
              onChange={e => setAuthorFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-muted)',
                background: 'var(--bg-card)',
                color: 'var(--color-text)',
                fontSize: '0.85rem',
                minWidth: 140,
              }}
            >
              <option value="">👥 所有作者</option>
              {authors.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          )}
        </div>

        {/* 作者统计摘要 */}
        {authors.length > 1 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, padding: '10px 14px',
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
          }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>团队成员：</span>
            {authors.map(a => {
              const count = commits.filter(c => c.author === a).length
              return (
                <span
                  key={a}
                  onClick={() => setAuthorFilter(prev => prev === a ? '' : a)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500,
                    background: authorFilter === a ? authorColor(a) + '30' : 'var(--bg-card)',
                    border: authorFilter === a ? `1px solid ${authorColor(a)}` : '1px solid var(--border-muted)',
                    color: authorFilter === a ? authorColor(a) : 'var(--color-text)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {/* 头像小圆圈 */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, borderRadius: '50%',
                    background: authorColor(a), color: '#fff', fontSize: '0.65rem', fontWeight: 700,
                  }}>
                    {authorInitial(a)}
                  </span>
                  {a}
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>({count})</span>
                </span>
              )
            })}
          </div>
        )}

        {/* 提交列表 */}
        <div className="commit-list">
          {filteredCommits.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              {commits.length === 0 ? '暂无提交记录' : '没有匹配的提交'}
            </div>
          ) : (
            filteredCommits.map((commit, i) => (
              <div
                key={commit.hash}
                className="commit-item"
                style={{ animationDelay: `${i * 20}ms`, cursor: 'pointer' }}
                onClick={() => onShowCommitDiff(commit.hash, commit.message)}
              >
                <div className="commit-dot"></div>
                <div className="commit-content">
                  <div className="commit-header">
                    <span className="commit-hash">{commit.short_hash}</span>
                    <span className="commit-date">{formatDate(commit.date)}</span>
                  </div>
                  <div className="commit-msg">{commit.message}</div>
                  {/* NOTE: 作者头像标签 —— 多人协作时一眼区分谁的提交 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, height: 20, borderRadius: '50%',
                      background: authorColor(commit.author), color: '#fff',
                      fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                    }}>
                      {authorInitial(commit.author)}
                    </span>
                    <span className="commit-author" style={{ color: authorColor(commit.author), fontWeight: 500 }}>
                      {commit.author}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
