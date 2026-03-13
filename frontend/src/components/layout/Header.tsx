import type { RepoInfo } from '../../api'

interface HeaderProps {
  repoInfo: RepoInfo | null
  onShowUserConfig: () => void
}

export default function Header({ repoInfo, onShowUserConfig }: HeaderProps) {
  const connected = repoInfo?.connected ?? false

  return (
    <header className="app-header" id="app-header">
      <div className="header-left">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="4" />
            <line x1="1.05" y1="12" x2="7" y2="12" />
            <line x1="17.01" y1="12" x2="22.96" y2="12" />
          </svg>
          <span>Git 管理工具</span>
        </div>
      </div>
      <div className="header-center">
        <div className="repo-indicator" id="repo-indicator">
          <span className={`repo-dot ${connected ? 'connected' : ''}`}></span>
          <span>{connected ? repoInfo?.path : '未连接仓库'}</span>
        </div>
      </div>
      <div className="header-right">
        <button
          className="btn btn-sm btn-ghost"
          onClick={onShowUserConfig}
          style={{ marginRight: 12, height: 32 }}
          title="配置用户信息"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          用户设置
        </button>
        {connected && repoInfo?.current_branch && (
          <div className="branch-badge" style={{ display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <span>{repoInfo.current_branch}</span>
          </div>
        )}
      </div>
    </header>
  )
}
