import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/api';
import { supabase } from '../lib/supabase';
import { X, Camera, Save } from 'lucide-react';

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { profile, fetchProfile } = useAuth();
  
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  
  const [username, setUsername] = useState(profile?.username || '');
  const [mobileNumber, setMobileNumber] = useState(profile?.mobile_number || '');
  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setNickname(profile.nickname || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
      setUsername(profile.username || '');
      setMobileNumber(profile.mobile_number || '');
      setIsPrivate(profile.is_private || false);
    }
  }, [profile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}_${Date.now()}.${fileExt}`;
    
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      console.error('Avatar upload failed', err);
      alert('Avatar upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        full_name: fullName,
        nickname,
        bio,
        avatar_url: avatarUrl,
        username,
        mobile_number: mobileNumber,
        is_private: isPrivate
      });
      await fetchProfile(); // refresh auth context profile
      onClose();
    } catch (err) {
      console.error('Failed to update profile', err);
      alert('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 'clamp(1.25rem, 5vw, 2rem)', width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
        
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', textAlign: 'center' }}>Edit Profile</h2>
        
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--accent-primary)' }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '2.5rem', color: 'var(--text-secondary)' }}>{profile?.username?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: 'var(--accent-primary)', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-secondary)' }}
              >
                <Camera size={16} />
              </button>
              <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Username</label>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username (Unique)" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Full Name</label>
            <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. John Doe" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Mobile Number</label>
            <input className="input" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="e.g. +8801700000000" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Nickname</label>
            <input className="input" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="e.g. Johnny" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Bio</label>
            <textarea 
              className="input" 
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              placeholder="Tell us about yourself..." 
              style={{ minHeight: '80px', resize: 'vertical' }} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input 
              type="checkbox" 
              id="isPrivate" 
              checked={isPrivate} 
              onChange={e => setIsPrivate(e.target.checked)} 
              style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent-primary)' }}
            />
            <label htmlFor="isPrivate" style={{ fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Private Mode (Hide me from public search)
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || uploading} style={{ marginTop: '1rem' }}>
            <Save size={18} style={{ marginRight: '0.5rem' }} />
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
