import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, User, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createChat, sendMessage } from '../services/api';

export default function MoodViewer({ 
  groupedMoods, 
  initialUserIndex, 
  onClose 
}: { 
  groupedMoods: any[][], 
  initialUserIndex: number, 
  onClose: () => void 
}) {
  const { user } = useAuth();
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [moodIndex, setMoodIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const currentUserMoods = groupedMoods[userIndex] || [];
  const currentMood = currentUserMoods[moodIndex];

  useEffect(() => {
    if (!currentMood) {
      onClose();
      return;
    }

    setProgress(0);
    const duration = 5000; // 5 seconds per mood
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (isPaused) return prev;
        
        if (prev >= 100) {
          handleNext();
          return 100;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [userIndex, moodIndex, currentMood, isPaused]);

  const handleNext = () => {
    if (moodIndex < currentUserMoods.length - 1) {
      setMoodIndex(moodIndex + 1);
    } else if (userIndex < groupedMoods.length - 1) {
      setUserIndex(userIndex + 1);
      setMoodIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (moodIndex > 0) {
      setMoodIndex(moodIndex - 1);
    } else if (userIndex > 0) {
      setUserIndex(userIndex - 1);
      setMoodIndex(groupedMoods[userIndex - 1].length - 1);
    }
  };

  const handleReplySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !currentMood || isSending) return;
    
    setIsSending(true);
    try {
      // 1. Get or create chat
      const chat = await createChat(currentMood.user_id);
      
      // 2. Send message
      const prefix = currentMood.content_type === 'image' 
        ? `[Replying to story 📸]: ` 
        : `[Replying to story 📝 "${currentMood.content_url}"]: `;
        
      await sendMessage(chat.id, prefix + replyText.trim());
      
      setReplyText('');
      setReplySuccess(true);
      setTimeout(() => setReplySuccess(false), 2000);
    } catch (err) {
      console.error(err);
      alert('Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  if (!currentMood) return null;

  const isMyMood = currentMood.user_id === user?.id;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      {/* Progress Bars */}
      <div style={{ display: 'flex', gap: '4px', padding: '1rem 1rem 0 1rem', zIndex: 10 }}>
        {currentUserMoods.map((_, i) => (
          <div key={i} style={{ flex: 1, height: '3px', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              backgroundColor: '#fff', 
              width: i < moodIndex ? '100%' : i === moodIndex ? `${progress}%` : '0%',
              transition: 'width 50ms linear'
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)', border: '1px solid rgba(255,255,255,0.2)' }}>
            {currentMood.user?.avatar_url ? (
              <img src={currentMood.user.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={20} color="white" style={{ margin: '6px' }} />
            )}
          </div>
          <div style={{ color: 'white', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            {currentMood.user?.username}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginLeft: '0.5rem', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            {new Date(currentMood.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button onClick={onClose} style={{ color: 'white', background: 'rgba(0,0,0,0.2)', borderRadius: '50%', padding: '0.25rem' }}>
          <X size={24} />
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {currentMood.content_type === 'image' ? (
          <img src={currentMood.content_url} alt="mood" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ padding: '2rem', fontSize: '1.5rem', color: 'white', textAlign: 'center', fontWeight: 500, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            {currentMood.content_url}
          </div>
        )}

        {/* Tap areas for navigation */}
        <div onClick={handlePrev} style={{ position: 'absolute', top: 0, left: 0, bottom: '80px', width: '30%', cursor: 'pointer', display: 'flex', alignItems: 'center', paddingLeft: '1rem', zIndex: 5 }}>
          {(userIndex > 0 || moodIndex > 0) && <ChevronLeft size={36} color="rgba(255,255,255,0.5)" />}
        </div>
        <div onClick={handleNext} style={{ position: 'absolute', top: 0, right: 0, bottom: '80px', width: '70%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '1rem', zIndex: 5 }}>
          <ChevronRight size={36} color="rgba(255,255,255,0.5)" />
        </div>
      </div>

      {/* Reply Area */}
      {!isMyMood && (
        <div style={{ padding: '1rem', zIndex: 10, display: 'flex', justifyContent: 'center', paddingBottom: '2rem' }}>
          <form onSubmit={handleReplySubmit} style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '400px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2rem', padding: '0.25rem 0.5rem 0.25rem 1rem', backdropFilter: 'blur(10px)' }}>
            <input 
              type="text" 
              placeholder={replySuccess ? "Reply sent!" : "Reply to story..."}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'white', outline: 'none' }}
              disabled={isSending || replySuccess}
              onFocus={(e) => { e.stopPropagation(); setIsPaused(true); }}
              onBlur={() => setIsPaused(false)}
            />
            <button type="submit" disabled={!replyText.trim() || isSending} style={{ backgroundColor: replyText.trim() ? 'var(--accent-primary)' : 'transparent', color: replyText.trim() ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: replyText.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
