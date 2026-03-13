import { useState, useCallback, useEffect } from 'react'
import Header from './components/layout/Header'
import Sidebar, { type PanelId } from './components/layout/Sidebar'
import ConnectPanel from './components/panels/ConnectPanel'
import StatusPanel from './components/panels/StatusPanel'
import BranchPanel from './components/panels/BranchPanel'
import BackupPanel from './components/panels/BackupPanel'
import HistoryPanel from './components/panels/HistoryPanel'
import RemotePanel from './components/panels/RemotePanel'
import ToastContainer from './components/ui/Toast'
import Modal from './components/ui/Modal'
import DiffViewer from './components/ui/DiffViewer'
import * as api from './api'
import type { RepoInfo } from './api'

export default function App() {
  const [activePanel, setActivePanel] = useState<PanelId>('connect')
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null)

  // Modal 状态
  const [modalVisible, setModalVisible] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const [modalOnConfirm, setModalOnConfirm] = useState<() => void>(() => () => {})

  // DiffViewer 状态
  const [diffVisible, setDiffVisible] = useState(false)
  const [diffFilename, setDiffFilename] = useState('')
  const [diffCommitHash, setDiffCommitHash] = useState<string | undefined>()
  const [diffFilepath, setDiffFilepath] = useState<string | undefined>()

  // 用户配置 Modal
  const [showUserConfigModal, setShowUserConfigModal] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  const refreshRepoInfo = useCallback(async () => {
    try {
      const info = await api.getRepoInfo()
      setRepoInfo(info)
    } catch {
      // 静默失败
    }
  }, [])

  useEffect(() => {
    refreshRepoInfo()
  }, [refreshRepoInfo])

  const handlePanelChange = useCallback((id: PanelId) => {
    setActivePanel(id)
  }, [])

  const handleShowDiff = useCallback((filepath: string) => {
    setDiffFilename(filepath)
    setDiffFilepath(filepath)
    setDiffCommitHash(undefined)
    setDiffVisible(true)
  }, [])

  const handleShowCommitDiff = useCallback((hash: string, message: string) => {
    setDiffFilename(message)
    setDiffCommitHash(hash)
    setDiffFilepath(undefined)
    setDiffVisible(true)
  }, [])

  const handleShowUserConfig = useCallback(async () => {
    try {
      const config = await api.getUserConfig()
      setUserName(config.name || '')
      setUserEmail(config.email || '')
    } catch {
      // 忽略
    }
    setShowUserConfigModal(true)
  }, [])

  const handleSaveUserConfig = useCallback(async () => {
    try {
      await api.setUserConfig(userName, userEmail)
      setShowUserConfigModal(false)
    } catch {
      // 忽略
    }
  }, [userName, userEmail])

  // 渲染当前面板
  const renderPanel = () => {
    switch (activePanel) {
      case 'connect':
        return <ConnectPanel onRepoConnected={refreshRepoInfo} />
      case 'status':
        return <StatusPanel onRefreshRepo={refreshRepoInfo} onShowDiff={handleShowDiff} />
      case 'branches':
        return <BranchPanel />
      case 'backup':
        return <BackupPanel />
      case 'history':
        return <HistoryPanel onShowCommitDiff={handleShowCommitDiff} />
      case 'remote':
        return <RemotePanel />
      default:
        return null
    }
  }

  return (
    <>
      <Header repoInfo={repoInfo} onShowUserConfig={handleShowUserConfig} />

      <main className="app-main">
        <Sidebar activePanel={activePanel} onPanelChange={handlePanelChange} />
        <div className="content-area" id="content-area">
          {renderPanel()}
        </div>
      </main>

      <ToastContainer />

      <Modal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        onConfirm={() => { modalOnConfirm(); setModalVisible(false) }}
        onCancel={() => setModalVisible(false)}
      />

      <DiffViewer
        visible={diffVisible}
        filename={diffFilename}
        commitHash={diffCommitHash}
        filepath={diffFilepath}
        onClose={() => setDiffVisible(false)}
      />

      {/* 用户配置弹窗 */}
      {showUserConfigModal && (
        <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-overlay')) setShowUserConfigModal(false) }}>
          <div className="modal">
            <div className="modal-header"><h3>用户配置</h3></div>
            <div className="modal-body">
              <div className="input-group">
                <label>用户名</label>
                <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="Your Name" />
              </div>
              <div className="input-group">
                <label>邮箱</label>
                <input type="text" value={userEmail} onChange={e => setUserEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowUserConfigModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSaveUserConfig}>保存</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
