import { useEffect, useState } from 'react';
import { playRingtone, stopRingtone } from '../services/audioEngine';

export function useNotifications() {
  const [permission, setPermission] = useState(Notification.permission);
  const [ringtoneId, setRingtoneId] = useState(localStorage.getItem('ringtone_id') || 'classic');

  useEffect(() => {
    const checkStorage = () => {
      const storedId = localStorage.getItem('ringtone_id');
      if (storedId && storedId !== ringtoneId) {
        setRingtoneId(storedId);
      }
    };
    // Custom event to listen for same-window storage changes since 'storage' event is cross-window
    window.addEventListener('ringtone_changed', checkStorage);
    return () => window.removeEventListener('ringtone_changed', checkStorage);
  }, [ringtoneId]);

  const requestPermission = async () => {
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      setPermission(result);
    }
  };

  const notify = (title: string, options?: NotificationOptions) => {
    if (permission === 'granted' && document.visibilityState === 'hidden') {
      new Notification(title, options);
      playRingtone(ringtoneId, false);
    } else if (document.visibilityState === 'hidden') {
      // Even if no desktop notification permission, we can play the sound
      playRingtone(ringtoneId, false);
    }
  };

  const startRing = () => {
    playRingtone(ringtoneId, true);
  };

  const stopRing = () => {
    stopRingtone();
  };

  return { permission, requestPermission, notify, startRing, stopRing, ringtoneId };
}
