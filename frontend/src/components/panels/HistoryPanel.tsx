import { useState, useCallback, useEffect } from 'react'
import * as api from '../../api'
import type { CommitInfo } from '../../api'
import { useToast } from '../../hooks/useToast'
import { formatDate } from '../../utils'

interface HistoryPanelProps {
  onShowCommitDiff: (hash: string, message: string) => void
}

export default function HistoryPanel({ onShowCommitDiff }: HistoryPanelProps) {
  const { showToast } = useToast()
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [searchQuery, setSearchQuery] = useState('')

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

  // 搜索过滤
  const filteredCommits = commits.filter(c => {
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
        {/* 搜索 */}
        <div className="history-search">
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
                  <div className="commit-author">{commit.author}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
