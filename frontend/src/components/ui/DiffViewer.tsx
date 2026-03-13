import { useState, useEffect, useCallback } from 'react'
import * as api from '../../api'

interface DiffViewerProps {
  visible: boolean
  filename: string
  /** 如果传入 commitHash，显示提交级别的 diff */
  commitHash?: string
  /** 如果传入 filepath，显示文件级别的 diff */
  filepath?: string
  onClose: () => void
}

export default function DiffViewer({
  visible,
  filename,
  commitHash,
  filepath,
  onClose,
}: DiffViewerProps) {
  const [loading, setLoading] = useState(false)
  const [diffHtml, setDiffHtml] = useState('')
  const [commitInfo, setCommitInfo] = useState<Record<string, string> | null>(null)
  const [fileList, setFileList] = useState<string[]>([])

  const loadDiff = useCallback(async () => {
    setLoading(true)
    setDiffHtml('')
    setCommitInfo(null)
    setFileList([])

    try {
      if (commitHash) {
        const data = await api.getCommitDiff(commitHash)
        setDiffHtml(formatDiff(data.diff))
        // NOTE: 后端返回 data.commit 而非 data.commit_info
        if (data.commit) setCommitInfo(data.commit)
        // NOTE: 后端返回 data.changed_files 而非 data.files
        if (data.changed_files) setFileList(data.changed_files.map(f => `[${f.status}] ${f.path}`))
      } else if (filepath) {
        const data = await api.getFileDiff(filepath)
        // NOTE: 后端返回 staged_diff / unstaged_diff / untracked_content，合并显示
        const combined = [data.staged_diff, data.unstaged_diff, data.untracked_content]
          .filter(Boolean)
          .join('\n')
        setDiffHtml(formatDiff(combined))
      }
    } catch (error) {
      setDiffHtml(`<div class="diff-error">加载失败: ${error instanceof Error ? error.message : '未知错误'}</div>`)
    } finally {
      setLoading(false)
    }
  }, [commitHash, filepath])

  useEffect(() => {
    if (visible) {
      loadDiff()
      // ESC 关闭
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [visible, loadDiff, onClose])

  if (!visible) return null

  return (
    <div className="diff-viewer-overlay" onClick={e => {
      if ((e.target as HTMLElement).classList.contains('diff-viewer-overlay')) onClose()
    }}>
      <div className="diff-viewer-panel">
        <div className="diff-viewer-header">
          <div className="diff-viewer-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>{filename}</span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {commitInfo && (
          <div className="diff-commit-info" style={{ display: 'block' }}>
            {Object.entries(commitInfo).map(([k, v]) => (
              <div key={k} className="diff-commit-row">
                <span className="diff-commit-label">{k}</span>
                <span className="diff-commit-value">{v}</span>
              </div>
            ))}
          </div>
        )}
        {fileList.length > 0 && (
          <div className="diff-file-list" style={{ display: 'block' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              变更文件 ({fileList.length}):
            </div>
            {fileList.map((f, i) => (
              <span key={i} className="diff-file-tag">{f}</span>
            ))}
          </div>
        )}
        <div className="diff-viewer-content">
          {loading ? (
            <div className="diff-loading">加载中...</div>
          ) : (
            <pre dangerouslySetInnerHTML={{ __html: diffHtml }} />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 将 diff 文本格式化为 HTML
 */
function formatDiff(raw: string): string {
  if (!raw) return '<div class="diff-empty">没有差异</div>'

  return raw
    .split('\n')
    .map(line => {
      let cls = 'diff-line'
      if (line.startsWith('+') && !line.startsWith('+++')) cls = 'diff-line diff-add'
      else if (line.startsWith('-') && !line.startsWith('---')) cls = 'diff-line diff-del'
      else if (line.startsWith('@@')) cls = 'diff-line diff-hunk'
      else if (line.startsWith('diff ')) cls = 'diff-line diff-header'

      // HTML 转义
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      return `<div class="${cls}">${escaped}</div>`
    })
    .join('')
}
