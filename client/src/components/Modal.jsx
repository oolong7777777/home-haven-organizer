import { useEffect, useId } from 'react'

export default function Modal({ title, onClose, children, size = 'md' }) {
  const titleId = useId()
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 id={titleId} className="text-base font-semibold text-gray-800">{title}</h2>
          <button
            aria-label="关闭弹窗"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-sm"
          >
            ✕
          </button>
        </div>
        <div className="haven-modal-body overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}
