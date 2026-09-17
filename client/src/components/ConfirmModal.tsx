import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = false
}: ConfirmModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div 
        style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          width: '100%', 
          maxWidth: '400px', 
          borderRadius: 'var(--radius-lg)', 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column', 
          boxShadow: 'var(--shadow-lg)',
          animation: 'fade-in 0.2s ease-out'
        }}
      >
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: isDestructive ? 'var(--danger)' : 'var(--text-primary)' }}>
            <AlertTriangle size={20} color={isDestructive ? "var(--danger)" : "var(--accent-primary)"} /> {title}
          </h2>
          <button type="button" onClick={onCancel} className="btn-icon" style={{ padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>
            {message}
          </p>
        </div>
        
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', backgroundColor: 'var(--bg-primary)' }}>
          <button type="button" onClick={onCancel} className="btn" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
            {cancelText}
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            className={`btn ${isDestructive ? '' : 'btn-primary'}`} 
            style={isDestructive ? { backgroundColor: 'var(--danger)', color: 'white' } : {}}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
