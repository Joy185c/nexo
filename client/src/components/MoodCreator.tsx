import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { createMood } from '../services/api';
import { X, Image as ImageIcon, Send, Type } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MoodCreator({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const { profile } = useAuth();
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextSubmit = async () => {
    if (!text.trim()) return;
    setUploading(true);
    try {
      await createMood('text', text.trim());
      onCreated();
    } catch (err) {
      console.error(err);
      alert('Failed to post mood');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile?.id}_${Date.now()}.${fileExt}`;
    
    try {
      const { error: uploadError } = await supabase.storage.from('moods').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('moods').getPublicUrl(fileName);
      await createMood('image', data.publicUrl);
      onCreated();
    } catch (err) {
      console.error(err);
      alert('Failed to post mood image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '400px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Create Mood</h2>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>
        
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => setMode('text')} 
              style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', backgroundColor: mode === 'text' ? 'var(--bg-tertiary)' : 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              <Type size={24} color={mode === 'text' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Text Mood</span>
            </button>
            <button 
              onClick={() => setMode('image')} 
              style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', backgroundColor: mode === 'image' ? 'var(--bg-tertiary)' : 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              <ImageIcon size={24} color={mode === 'image' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
              <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Photo Mood</span>
            </button>
          </div>

          {mode === 'text' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea 
                className="input" 
                placeholder="What's on your mind? (Visible to friends for 24h)" 
                value={text}
                onChange={e => setText(e.target.value)}
                style={{ minHeight: '120px', resize: 'vertical', fontSize: '1.1rem', textAlign: 'center', padding: '2rem 1rem' }}
                autoFocus
              />
              <button className="btn btn-primary" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }} disabled={!text.trim() || uploading} onClick={handleTextSubmit}>
                <Send size={18} /> {uploading ? 'Posting...' : 'Share Mood'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '2rem 0' }}>
              <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
              <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem' }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <ImageIcon size={18} /> {uploading ? 'Uploading...' : 'Select Photo'}
              </button>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Visible to friends for 24h</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
