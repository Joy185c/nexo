import { useState, useEffect } from 'react';
import { getUserProfile, blockUser, unblockUser, setCustomNickname, getSharedMedia } from '../services/api';
import { X, User, Edit3, ShieldAlert, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Lightbox from './Lightbox';

export default function UserProfile({ userId, onClose }: { userId: string, onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { blockedUsers, refreshPreferences, contacts, user } = useAuth();
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  
  const [sharedMedia, setSharedMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const isBlocked = blockedUsers.includes(userId);
  const isSelf = user?.id === userId;
  
  const customContact = contacts.find(c => c.contact_id === userId);

  useEffect(() => {
    loadProfile();
    loadSharedMedia();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await getUserProfile(userId);
      setProfile(res);
      setNicknameInput(customContact?.custom_nickname || '');
    } catch (err) {
      console.error(err);
      alert('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadSharedMedia = async () => {
    try {
      setLoadingMedia(true);
      const res = await getSharedMedia(userId);
      // Filter out only image media types for the grid
      const imageMedia = res.filter((m: any) => m.media_type?.startsWith('image/'));
      setSharedMedia(imageMedia);
    } catch (err) {
      console.error('Failed to load shared media', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleToggleBlock = async () => {
    try {
      if (isBlocked) {
        await unblockUser(userId);
      } else {
        if (!confirm('Are you sure you want to block this user? They will not be able to message you.')) return;
        await blockUser(userId);
      }
      await refreshPreferences();
    } catch (err) {
      console.error(err);
      alert('Failed to update block status');
    }
  };

  const handleSaveNickname = async () => {
    try {
      await setCustomNickname(userId, nicknameInput);
      await refreshPreferences();
      setIsEditingNickname(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save nickname');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '2rem', width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--text-secondary)' }}>
          <X size={20} />
        </button>
        
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading profile...</div>
        ) : profile ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--accent-primary)' }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={40} color="var(--text-secondary)" />
              )}
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {customContact?.custom_nickname || profile.full_name || profile.username}
                {!isSelf && (
                  <button onClick={() => setIsEditingNickname(!isEditingNickname)} style={{ color: 'var(--text-secondary)' }}>
                    <Edit3 size={14} />
                  </button>
                )}
              </h2>
              
              {isEditingNickname && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'center' }}>
                  <input className="input" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} placeholder="Set custom name..." value={nicknameInput} onChange={e => setNicknameInput(e.target.value)} />
                  <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={handleSaveNickname}>Save</button>
                </div>
              )}
              
              <div style={{ color: 'var(--accent-primary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>@{profile.username}</div>
              {profile.nickname && <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>aka "{profile.nickname}"</div>}
            </div>

            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)', margin: '0.5rem 0' }} />
            
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Bio</div>
              <div style={{ fontSize: '0.875rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {profile.bio || 'This user has not set a bio yet.'}
              </div>
            </div>

            {!isSelf && (
              <div style={{ width: '100%', marginTop: '0.5rem' }}>
                <button 
                  onClick={handleToggleBlock}
                  className="btn" 
                  style={{ width: '100%', padding: '0.5rem', backgroundColor: isBlocked ? 'var(--bg-tertiary)' : 'rgba(239, 68, 68, 0.1)', color: isBlocked ? 'var(--text-primary)' : 'var(--danger)', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                >
                  {isBlocked ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                  {isBlocked ? 'Unblock User' : 'Block User'}
                </button>
              </div>
            )}

            <div style={{ width: '100%', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Joined: {new Date(profile.last_seen).toLocaleDateString()}
            </div>

            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)', margin: '1rem 0' }} />

            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <ImageIcon size={18} color="var(--accent-primary)" /> Shared Media
              </div>
              
              {loadingMedia ? (
                <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading media...</div>
              ) : sharedMedia.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                  {sharedMedia.map(media => (
                    <div 
                      key={media.id} 
                      onClick={() => setLightboxImage(media.media_url)}
                      style={{ 
                        aspectRatio: '1', 
                        cursor: 'pointer',
                        overflow: 'hidden',
                        borderRadius: '4px'
                      }}
                    >
                      <img 
                        src={media.media_url} 
                        alt="shared" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }} 
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)', padding: '1rem 0' }}>
                  No shared photos found
                </div>
              )}
            </div>

          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--danger)' }}>Profile not found</div>
        )}
      </div>

      {lightboxImage && (
        <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}
