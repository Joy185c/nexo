import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { Session, User, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
  refreshPreferences: () => Promise<void>;
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
  refreshPreferences: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        fetchProfile(session.access_token);
        refreshPreferences(session.access_token);
        setupPresence(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        fetchProfile(session.access_token);
        refreshPreferences(session.access_token);
        setupPresence(session.user.id);
      } else {
        setProfile(null);
        setBlockedUsers([]);
        setContacts([]);
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

  const fetchProfile = async (token?: string) => {
    try {
      const activeToken = token || session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
      if (!activeToken) return;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPreferences = async (token?: string) => {
    try {
      const activeToken = token || session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
      if (!activeToken) return;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/users/me/preferences`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setBlockedUsers(data.data.blockedUsers);
        setContacts(data.data.contacts);
      }
    } catch (e) {
      console.error('Failed to fetch preferences', e);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, logout, onlineUsers, fetchProfile, blockedUsers, contacts, refreshPreferences }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
