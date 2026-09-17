import { useEffect, useState } from 'react';
import { playRingtone, stopRingtone, playNotificationSound } from '../services/audioEngine';

export function useNotifications() {
  const [permission, setPermission] = useState(Notification.permission);
  const [ringtoneId, setRingtoneId] = useState(localStorage.getItem('ringtone_id') || 'classic');
  const [messageSoundId, setMessageSoundId] = useState(localStorage.getItem('message_sound_id') || 'tri-tone');

  useEffect(() => {
    const checkStorage = () => {
      const storedRingtone = localStorage.getItem('ringtone_id');
      if (storedRingtone && storedRingtone !== ringtoneId) setRingtoneId(storedRingtone);
      const storedMsgSound = localStorage.getItem('message_sound_id');
      if (storedMsgSound && storedMsgSound !== messageSoundId) setMessageSoundId(storedMsgSound);
    };
    window.addEventListener('ringtone_changed', checkStorage);
    window.addEventListener('message_sound_changed', checkStorage);
    return () => {
      window.removeEventListener('ringtone_changed', checkStorage);
      window.removeEventListener('message_sound_changed', checkStorage);
    };
  }, [ringtoneId, messageSoundId]);

  const requestPermission = async () => {
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      setPermission(result);
    }
  };

  const notify = (title: string, options?: NotificationOptions) => {
    // Always play the message sound when a new message arrives
    playNotificationSound(messageSoundId);
    if (permission === 'granted' && document.visibilityState === 'hidden') {
      new Notification(title, options);
    }
  };

  const startRing = () => {
    playRingtone(ringtoneId, true);
  };

  const stopRing = () => {
    stopRingtone();
  };

  return { permission, requestPermission, notify, startRing, stopRing, ringtoneId, messageSoundId };
}
