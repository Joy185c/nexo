import { useState, useEffect } from 'react';
import { RINGTONES, playRingtone, stopRingtone } from '../services/audioEngine';
import { X, Play, Square, Bell } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [selectedId, setSelectedId] = useState(localStorage.getItem('ringtone_id') || 'classic');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [permission, setPermission] = useState(Notification.permission);

  const requestPermission = async () => {
    if (Notification.permission === 'denied') {
      alert('Notifications are currently blocked by your browser. Please click the lock/site-settings icon in your URL bar (top left) and allow notifications.');
      return;
    }
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      setPermission(result);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    localStorage.setItem('ringtone_id', id);
    window.dispatchEvent(new Event('ringtone_changed'));
  };

  const togglePreview = (id: string) => {
    if (playingId === id) {
      stopRingtone();
      setPlayingId(null);
    } else {
      playRingtone(id, true);
      setPlayingId(id);
    }
  };

  useEffect(() => {
    return () => {
      stopRingtone();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', width: '100%', maxWidth: '400px', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} /> Notifications & Sounds
          </h2>
          <button onClick={onClose} className="btn" style={{ padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Desktop Notifications</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Status: {permission === 'granted' ? <span style={{color: 'var(--success)'}}>Enabled</span> : 'Disabled'}</span>
              {permission !== 'granted' && (
                <button onClick={requestPermission} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                  Enable
                </button>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Ringtone</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {RINGTONES.map(rt => (
                <div key={rt.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem', backgroundColor: selectedId === rt.id ? 'var(--bg-tertiary)' : 'transparent', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => handleSelect(rt.id)}>
                  <input type="radio" checked={selectedId === rt.id} onChange={() => handleSelect(rt.id)} style={{ marginRight: '1rem' }} />
                  <span style={{ flex: 1 }}>{rt.name}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); togglePreview(rt.id); }} 
                    className="btn" 
                    style={{ padding: '0.25rem', backgroundColor: playingId === rt.id ? 'var(--danger)' : 'var(--bg-tertiary)', color: playingId === rt.id ? 'white' : 'inherit' }}
                  >
                    {playingId === rt.id ? <Square size={16} /> : <Play size={16} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
