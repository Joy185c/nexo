import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { Session, User, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getUserPreferences, getFriends, registerDevice } from '../services/api';
import { generateKeyPair, exportPublicKey, savePrivateKey, loadPrivateKey } from '../lib/crypto';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  onlineUsers: string[];
  fetchProfile: () => Promise<void>;
  blockedUsers: string[];
  contacts: any[];
  friends: any[];
  fetchPreferences: () => Promise<void>;
  fetchFriends: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  logout: async () => {},
  onlineUsers: [],
  fetchProfile: async () => {},
  blockedUsers: [],
  contacts: [],
  friends: [],
  fetchPreferences: async () => {},
  fetchFriends: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
        fetchProfile();
        fetchPreferences();
        fetchFriends();
        initDeviceSession(session.user.id);
        setupPresence(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
        fetchProfile();
        fetchPreferences();
        fetchFriends();
        initDeviceSession(session.user.id);
        setupPresence(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setBlockedUsers([]);
        setContacts([]);
        setFriends([]);
        setIsLoading(false);
        if (presenceChannelRef.current) {
          supabase.removeChannel(presenceChannelRef.current);
          presenceChannelRef.current = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, []);

  // Heartbeat mechanism for time tracking
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (session?.user) {
      interval = setInterval(() => {
        import('../services/api').then(({ sendHeartbeat }) => sendHeartbeat().catch(console.error));
      }, 5 * 60 * 1000); // 5 minutes
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session]);

  const setupPresence = (userId: string) => {
    if (presenceChannelRef.current) return;
    const channel = supabase.channel('global_presence');
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const onlineIds = Object.values(state).flatMap((presences: any) => presences.map((p: any) => p.user_id));
      setOnlineUsers(Array.from(new Set(onlineIds)));
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });
    presenceChannelRef.current = channel;
  };

  const initDeviceSession = async (userId: string) => {
    try {
      let deviceId = localStorage.getItem('nexo_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('nexo_device_id', deviceId);
      }

      await registerDevice(deviceId);

      // Listen for session termination (if this device gets deleted because of >2 limit)
      const channel = supabase.channel(`device_sessions_${deviceId}`)
        .on('postgres_changes', { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'device_sessions',
          filter: `device_id=eq.${deviceId}`
        }, () => {
           // Auto logout!
           alert("You have been logged out because your account is active on too many devices.");
           supabase.auth.signOut();
        })
        .subscribe();
        
    } catch (err) {
      console.error("Device registration failed:", err);
    }
  };

  const fetchProfile = async () => {
    try {
      const activeToken = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
      if (!activeToken) return;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        
        // E2EE Key Initialization
        try {
          let privKey = await loadPrivateKey(data.data.id);
          if (!privKey || !data.data.public_key) {
            console.log('Generating new E2EE Key Pair...');
            const keyPair = await generateKeyPair();
            const pubKeyBase64 = await exportPublicKey(keyPair.publicKey);
            await savePrivateKey(keyPair.privateKey, data.data.id);
            
            await supabase.from('users').update({ public_key: pubKeyBase64 }).eq('id', data.data.id);
            setProfile({ ...data.data, public_key: pubKeyBase64 });
            console.log('New E2EE Key Pair generated and saved.');
          }
        } catch (err) {
          console.error('Failed to init E2EE keys', err);
        }
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const prefs = await getUserPreferences();
      setBlockedUsers(prefs.blockedUsers || []);
      setContacts(prefs.contacts || []);
    } catch (e) {
      console.error('Failed to fetch preferences', e);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await getFriends();
      setFriends(res);
    } catch (e) {
      console.error('Failed to fetch friends', e);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, logout, onlineUsers, fetchProfile, blockedUsers, contacts, friends, fetchPreferences, fetchFriends }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
