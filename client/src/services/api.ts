import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL;

const getAuthToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
};

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'API Error');
  }
  return data.data;
};

export const searchUsers = (query: string) => apiFetch(`/users?q=${encodeURIComponent(query)}`);
export const getChats = () => apiFetch(`/chats`);
export const createChat = (userId: string) => apiFetch(`/chats`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
export const getMessages = (chatId: string, page = 1) => apiFetch(`/messages/${chatId}?page=${page}`);
export const sendMessage = (chatId: string, content: string, media_url?: string, media_type?: string, reply_to_id?: string) => 
  apiFetch(`/messages`, { method: 'POST', body: JSON.stringify({ chat_id: chatId, content, media_url, media_type, reply_to_id }) });

export const createGroup = (name: string, members: string[] = []) => apiFetch(`/chats/group`, { method: 'POST', body: JSON.stringify({ name, members }) });
export const addMember = (chatId: string, userId: string) => apiFetch(`/chats/${chatId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) });
export const removeMember = (chatId: string, userId: string) => apiFetch(`/chats/${chatId}/members/${userId}`, { method: 'DELETE' });
export const updateRole = (chatId: string, userId: string, role: string) => apiFetch(`/chats/${chatId}/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
export const markAsRead = (chatId: string) => apiFetch(`/messages/${chatId}/read`, { method: 'POST' });
export const searchMessages = (query: string) => apiFetch(`/messages/search?q=${encodeURIComponent(query)}`);

// Phase 12 Additions
export const reactToMessage = (chatId: string, messageId: string, emoji: string) => apiFetch(`/messages/${chatId}/messages/${messageId}/reaction`, { method: 'PUT', body: JSON.stringify({ emoji }) });
export const pinMessage = (chatId: string, messageId: string) => apiFetch(`/messages/${chatId}/messages/${messageId}/pin`, { method: 'PUT' });
export const unsendMessage = (chatId: string, messageId: string) => apiFetch(`/messages/${chatId}/messages/${messageId}`, { method: 'DELETE' });
export const deleteForMe = (chatId: string, messageId: string) => apiFetch(`/messages/${chatId}/messages/${messageId}/delete-for-me`, { method: 'PUT' });
export const deleteConversation = (chatId: string) => apiFetch(`/chats/${chatId}`, { method: 'DELETE' });

// Phase 14 Additions
export const getUserProfile = (userId: string) => apiFetch(`/users/${userId}`);
export const updateProfile = (data: { full_name?: string, nickname?: string, bio?: string, avatar_url?: string }) => apiFetch(`/users/me`, { method: 'PUT', body: JSON.stringify(data) });

// Phase 15 Additions
export const getUserPreferences = () => apiFetch(`/users/me/preferences`);
export const blockUser = (userId: string) => apiFetch(`/users/${userId}/block`, { method: 'POST' });
export const unblockUser = (userId: string) => apiFetch(`/users/${userId}/block`, { method: 'DELETE' });
export const setCustomNickname = (userId: string, nickname: string) => apiFetch(`/users/contacts/${userId}`, { method: 'PUT', body: JSON.stringify({ custom_nickname: nickname }) });
export const getSharedMedia = (userId: string) => apiFetch(`/users/${userId}/media`);
