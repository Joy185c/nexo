import { useState } from 'react';
import { X, Users } from 'lucide-react';

export default function CreateGroupModal({ onClose, onSubmit }: { onClose: () => void, onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

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
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Users size={20} color="var(--accent-primary)" /> Create New Group
          </h2>
          <button type="button" onClick={onClose} className="btn-icon" style={{ padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Group Name
            </label>
            <input 
              autoFocus
              type="text" 
              className="input" 
              placeholder="e.g. Weekend Plans" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
