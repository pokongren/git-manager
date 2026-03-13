/**
 * 工具函数集
 */

/**
 * 格式化日期字符串为更友好的格式
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin} 分钟前`
    if (diffHour < 24) return `${diffHour} 小时前`
    if (diffDay < 7) return `${diffDay} 天前`

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr
  }
}

/**
 * 格式化日期为简短格式
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffDay < 1) return '今天'
    if (diffDay < 2) return '昨天'
    if (diffDay < 7) return `${diffDay} 天前`

    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * HTML 转义
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 最近仓库的 localStorage 管理
 */
const RECENT_REPOS_KEY = 'git-manager-recent-repos'
const MAX_RECENT = 5

export function getRecentRepos(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_REPOS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRecentRepo(path: string): void {
  const repos = getRecentRepos().filter(r => r !== path)
  repos.unshift(path)
  if (repos.length > MAX_RECENT) repos.length = MAX_RECENT
  localStorage.setItem(RECENT_REPOS_KEY, JSON.stringify(repos))
}
