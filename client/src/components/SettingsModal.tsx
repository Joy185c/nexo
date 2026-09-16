import { useState, useEffect } from 'react';
import { RINGTONES, playRingtone, stopRingtone } from '../services/audioEngine';
import { X, Play, Square, Bell, Music, ChevronDown, ChevronUp, Image as ImageIcon, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const WALLPAPER_COLORS = [
  'default', '#e5ddd5', '#d9ece5', '#cce3ce', '#85c3a6', '#c4e3e6', '#cce9f5',
  '#aed8e6', '#c9d9f2', '#aebfdb', '#d7d4f0', '#f2d5d5', '#fce3b8', '#ffc696',
  '#f2b1a8', '#f29c9f', '#ef707a', '#879bb6', '#5d6f82', '#334c54', '#202d33',
  '#111b21', '#000000'
];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [selectedId, setSelectedId] = useState(localStorage.getItem('ringtone_id') || 'classic');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [permission, setPermission] = useState(Notification.permission);
  const [theme, setTheme] = useState(localStorage.getItem('nexo_theme') || 'light');
  const [showRingtones, setShowRingtones] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [wallpaperColor, setWallpaperColor] = useState(localStorage.getItem('nexo_wallpaper_color') || 'default');
  const [doodlesEnabled, setDoodlesEnabled] = useState(localStorage.getItem('nexo_wallpaper_doodles') !== 'false');
  const [wallpaperImage, setWallpaperImage] = useState(localStorage.getItem('nexo_wallpaper_image') || '');
  const [wallpaperOpacity, setWallpaperOpacity] = useState(parseInt(localStorage.getItem('nexo_wallpaper_opacity') || '100', 10));
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  
  const { user } = useAuth();

  const updateWallpaper = (color: string, doodles: boolean, image: string = wallpaperImage, opacity: number = wallpaperOpacity) => {
    setWallpaperColor(color);
    setDoodlesEnabled(doodles);
    setWallpaperImage(image);
    setWallpaperOpacity(opacity);
    localStorage.setItem('nexo_wallpaper_color', color);
    localStorage.setItem('nexo_wallpaper_doodles', doodles.toString());
    localStorage.setItem('nexo_wallpaper_image', image);
    localStorage.setItem('nexo_wallpaper_opacity', opacity.toString());
    window.dispatchEvent(new Event('wallpaper_changed'));
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingWallpaper(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `wallpaper_${user?.id}_${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage.from('avatars').upload(fileName, file);
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      updateWallpaper('custom', doodlesEnabled, data.publicUrl, wallpaperOpacity);
    } catch (err: any) {
      console.error(err);
      alert('Failed to upload wallpaper: ' + err.message);
    } finally {
      setUploadingWallpaper(false);
    }
  };

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
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', width: '100%', maxWidth: '400px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
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
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Desktop Notifications</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.9rem' }}>Status: {permission === 'granted' ? <span style={{color: 'var(--success)', fontWeight: 600}}>Enabled</span> : 'Disabled'}</span>
              {permission !== 'granted' && (
                <button onClick={requestPermission} className="btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
                  Enable
                </button>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Appearance</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.9rem' }}>Theme</span>
              <select 
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none' }}
                value={theme}
                onChange={(e) => {
                  const newTheme = e.target.value;
                  setTheme(newTheme);
                  localStorage.setItem('nexo_theme', newTheme);
                  document.documentElement.setAttribute('data-theme', newTheme);
                }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          <div>
            <div 
              onClick={() => setShowWallpaper(!showWallpaper)}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', 
                cursor: 'pointer', userSelect: 'none', marginBottom: '1rem' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                <ImageIcon size={18} color="var(--accent-primary)" />
                <span>Chat Wallpaper</span>
              </div>
              {showWallpaper ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>

            {showWallpaper && (
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    checked={doodlesEnabled} 
                    onChange={(e) => updateWallpaper(wallpaperColor, e.target.checked)} 
                    style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px' }}
                  />
                  Add chat doodles
                </label>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                  {WALLPAPER_COLORS.map(color => (
                    <div 
                      key={color}
                      onClick={() => updateWallpaper(color, doodlesEnabled, '', wallpaperOpacity)}
                      style={{ 
                        aspectRatio: '1', 
                        backgroundColor: color === 'default' ? 'var(--bg-primary)' : color,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: (wallpaperColor === color && !wallpaperImage) ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        boxShadow: (wallpaperColor === color && !wallpaperImage) ? '0 0 0 2px var(--bg-secondary) inset' : 'none',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {color === 'default' && <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Default</span>}
                      {wallpaperColor === color && !wallpaperImage && color !== 'default' && (
                         <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <Check size={16} color="white" />
                         </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Custom Background Image</h4>
                  
                  {wallpaperImage && (
                    <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                      <img src={wallpaperImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        onClick={() => updateWallpaper('default', doodlesEnabled, '', wallpaperOpacity)}
                        className="btn-icon"
                        style={{ position: 'absolute', top: '5px', right: '5px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 500, fontSize: '0.85rem' }}>
                    <ImageIcon size={18} style={{ marginRight: '0.5rem' }} />
                    {uploadingWallpaper ? 'Uploading...' : 'Upload from Gallery'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingWallpaper} onChange={handleWallpaperUpload} />
                  </label>

                  {wallpaperImage && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span>Transparency</span>
                        <span>{wallpaperOpacity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={wallpaperOpacity}
                        onChange={(e) => updateWallpaper(wallpaperColor, doodlesEnabled, wallpaperImage, parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <div 
              onClick={() => setShowRingtones(!showRingtones)}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', 
                cursor: 'pointer', userSelect: 'none' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                <Music size={18} color="var(--accent-primary)" />
                <span>Ringtone</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({RINGTONES.find(r => r.id === selectedId)?.name})</span>
              </div>
              {showRingtones ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>

            {showRingtones && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)' }}>
                {RINGTONES.map(rt => (
                  <div key={rt.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: selectedId === rt.id ? 'var(--accent-muted)' : 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: selectedId === rt.id ? '1px solid var(--accent-primary)' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleSelect(rt.id)}>
                    <input type="radio" checked={selectedId === rt.id} onChange={() => handleSelect(rt.id)} style={{ marginRight: '1rem', accentColor: 'var(--accent-primary)' }} />
                    <span style={{ flex: 1, fontWeight: selectedId === rt.id ? 600 : 400, color: selectedId === rt.id ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{rt.name}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); togglePreview(rt.id); }} 
                      className="btn-icon" 
                      style={{ backgroundColor: playingId === rt.id ? 'var(--danger)' : 'var(--bg-secondary)', color: playingId === rt.id ? 'white' : 'inherit' }}
                    >
                      {playingId === rt.id ? <Square size={16} /> : <Play size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
