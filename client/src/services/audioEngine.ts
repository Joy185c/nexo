let audioCtx: AudioContext | null = null;
let currentOscillators: OscillatorNode[] = [];
let loopTimeout: number | null = null;
let isPlaying = false;
let currentNotificationAudio: HTMLAudioElement | null = null;

export const RINGTONES = [
  { id: 'iphone', name: 'iRingtone (Marimba)' },
  { id: 'whistle', name: 'Cheerful Whistle' },
  { id: 'smooth', name: 'Smooth Ambience' },
  { id: 'classic', name: 'Classic Telephone' },
  { id: 'digital', name: 'Digital Pulse' },
  { id: 'urgent', name: 'Urgent Alarm' },
  { id: 'soft', name: 'Soft Bell' },
  { id: 'scifi', name: 'Sci-Fi Incoming' },
  { id: 'modern', name: 'Modern Minimal' },
  { id: 'synth', name: 'Synth Wave' }
];

// Message notification sounds (MP3 from SoundDino)
export const MESSAGE_SOUNDS = [
  { id: 'ding', name: '🔔 Ding', file: '/sounds/ding.mp3' },
  { id: 'glass', name: '🪟 Glass', file: '/sounds/glass.mp3' },
  { id: 'tri-tone', name: '🎵 Tri-Tone (Classic iMessage)', file: '/sounds/tri-tone.mp3' },
  { id: 'chime', name: '🔔 Notification Chime', file: '/sounds/chime.mp3' },
  { id: 'bubble', name: '💬 Bubble Pop', file: '/sounds/bubble.mp3' },
  { id: 'twitter', name: '🐦 Twitter Bird', file: '/sounds/twitter.mp3' },
  { id: 'mail', name: '✉️ Mail Notice', file: '/sounds/mail.mp3' },
  { id: 'soft', name: '🎶 Soft Tone', file: '/sounds/soft.mp3' },
  { id: 'none', name: '🔇 No Sound', file: '' },
];

export const playNotificationSound = (soundId: string) => {
  const sound = MESSAGE_SOUNDS.find(s => s.id === soundId);
  if (!sound || !sound.file) return;
  try {
    if (currentNotificationAudio) {
      currentNotificationAudio.pause();
      currentNotificationAudio.currentTime = 0;
    }
    currentNotificationAudio = new Audio(sound.file);
    currentNotificationAudio.volume = 1.0;
    currentNotificationAudio.play().catch(e => console.warn('Notification sound failed:', e));
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
};

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const stopRingtone = () => {
  isPlaying = false;
  if (loopTimeout) {
    clearTimeout(loopTimeout);
    loopTimeout = null;
  }
  currentOscillators.forEach(osc => {
    try { osc.stop(); osc.disconnect(); } catch (e) {}
  });
  currentOscillators = [];
};

const playTone = (
  freq: number | [number, number], // Can be a single frequency or an array for sliding pitch
  type: OscillatorType, 
  startTime: number, 
  duration: number, 
  vol = 0.5,
  attack = 0.05,
  release = 0.05
) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = type;
  
  if (Array.isArray(freq)) {
    // Sliding pitch (glissando) for whistles
    osc.frequency.setValueAtTime(freq[0], startTime);
    osc.frequency.exponentialRampToValueAtTime(freq[1], startTime + duration);
  } else {
    osc.frequency.setValueAtTime(freq, startTime);
  }
  
  // Envelope to prevent clicking and shape the sound
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(vol, startTime + attack);
  gainNode.gain.setValueAtTime(vol, startTime + duration - release);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
  currentOscillators.push(osc);
};

export const playRingtone = (id: string, loop: boolean = true) => {
  initAudio();
  stopRingtone();
  isPlaying = true;

  const playSequence = () => {
    if (!isPlaying || !audioCtx) return;
    const now = audioCtx.currentTime;
    let loopDuration = 2000;

    switch (id) {
      case 'iphone':
        // Fast, bouncy marimba-like sequence reminiscent of the iPhone opening theme
        loopDuration = 2200;
        const iNotes = [
          { f: 880, t: 0 }, { f: 1108.73, t: 0.15 }, { f: 1318.51, t: 0.3 },
          { f: 880, t: 0.45 }, { f: 1108.73, t: 0.6 }, { f: 1760, t: 0.75 },
          { f: 1108.73, t: 0.9 }, { f: 1318.51, t: 1.05 }, { f: 880, t: 1.2 }
        ];
        iNotes.forEach(note => {
          playTone(note.f, 'triangle', now + note.t, 0.12, 0.6, 0.01, 0.1);
        });
        break;

      case 'whistle':
        // Cheerful sliding sine waves to emulate human whistling
        loopDuration = 2500;
        playTone([1046.5, 1318.5], 'sine', now, 0.2, 0.4, 0.1, 0.1);
        playTone([1318.5, 1567.9], 'sine', now + 0.25, 0.2, 0.4, 0.1, 0.1);
        playTone([1567.9, 1318.5], 'sine', now + 0.5, 0.2, 0.4, 0.1, 0.1);
        playTone([2093, 2093], 'sine', now + 0.8, 0.4, 0.4, 0.1, 0.3);
        break;

      case 'smooth':
        // Long, slowly evolving major 7th chord for a smooth, calming vibe
        loopDuration = 4000;
        playTone(440, 'sine', now, 3.0, 0.2, 1.0, 1.0); // A4
        playTone(554.37, 'sine', now + 0.5, 2.5, 0.15, 1.0, 1.0); // C#5
        playTone(659.25, 'sine', now + 1.0, 2.0, 0.15, 1.0, 1.0); // E5
        playTone(830.61, 'sine', now + 1.5, 1.5, 0.1, 1.0, 0.5); // G#5
        break;

      case 'classic':
        loopDuration = 2500;
        for (let i = 0; i < 15; i++) {
          playTone(600, 'square', now + (i * 0.05), 0.025, 0.15, 0.005, 0.005);
          playTone(750, 'square', now + (i * 0.05) + 0.025, 0.025, 0.15, 0.005, 0.005);
        }
        break;
        
      case 'digital':
        loopDuration = 2000;
        playTone(800, 'sine', now, 0.2);
        playTone(800, 'sine', now + 0.4, 0.2);
        playTone(800, 'sine', now + 0.8, 0.2);
        break;

      case 'urgent':
        loopDuration = 1000;
        playTone(900, 'sawtooth', now, 0.1, 0.1);
        playTone(1200, 'sawtooth', now + 0.15, 0.1, 0.1);
        playTone(900, 'sawtooth', now + 0.3, 0.1, 0.1);
        break;

      case 'soft':
        loopDuration = 4000;
        playTone(440, 'sine', now, 1.5, 0.3, 0.5, 0.5);
        playTone(660, 'sine', now + 0.5, 1.0, 0.2, 0.5, 0.5);
        break;

      case 'scifi':
        loopDuration = 2500;
        playTone([400, 1200], 'sine', now, 0.5, 0.2, 0.1, 0.4);
        break;

      case 'modern':
        loopDuration = 2000;
        playTone(1000, 'square', now, 0.05, 0.1, 0.01, 0.04);
        playTone(1000, 'square', now + 0.2, 0.05, 0.1, 0.01, 0.04);
        break;

      case 'synth':
        loopDuration = 3000;
        playTone(300, 'sawtooth', now, 0.5, 0.15);
        playTone(450, 'sawtooth', now + 0.1, 0.4, 0.15);
        playTone(600, 'sawtooth', now + 0.2, 0.3, 0.15);
        break;

      default:
        loopDuration = 2000;
        playTone(800, 'sine', now, 0.2);
    }

    if (loop) {
      loopTimeout = window.setTimeout(playSequence, loopDuration);
    }
  };

  playSequence();
};
