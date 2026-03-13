import { useRef, useEffect } from 'react'

interface ModalProps {
  visible: boolean
  title: string
  message: string
  confirmText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function Modal({
  visible,
  title,
  message,
  confirmText = '确认',
  danger = true,
  onConfirm,
  onCancel,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (visible) {
      // ESC 关闭
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel()
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [visible, onCancel])

  if (!visible) return null

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={e => {
        if (e.target === overlayRef.current) onCancel()
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>
            取消
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
