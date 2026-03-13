import type { ReactNode } from 'react'

export type PanelId = 'connect' | 'status' | 'branches' | 'backup' | 'history' | 'remote'

interface NavItem {
  id: PanelId
  label: string
  group: string
  icon: ReactNode
}

const navItems: NavItem[] = [
  {
    id: 'connect', label: '连接仓库', group: '仓库',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
  },
  {
    id: 'status', label: '仓库状态', group: '仓库',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
  },
  {
    id: 'branches', label: '分支管理', group: '操作',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>,
  },
  {
    id: 'backup', label: '备份还原', group: '操作',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>,
  },
  {
    id: 'history', label: '提交历史', group: '操作',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  },
  {
    id: 'remote', label: '远程同步', group: '操作',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  },
]

interface SidebarProps {
  activePanel: PanelId
  onPanelChange: (id: PanelId) => void
}

export default function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  // 按 group 分组
  const groups = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  return (
    <nav className="sidebar" id="sidebar">
      {Object.entries(groups).map(([group, items]) => (
        <div className="nav-group" key={group}>
          <div className="nav-label">{group}</div>
          {items.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activePanel === item.id ? 'active' : ''}`}
              data-panel={item.id}
              onClick={() => onPanelChange(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}
