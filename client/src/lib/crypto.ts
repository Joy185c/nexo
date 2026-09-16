const DB_NAME = 'NexoCryptoDB';
const STORE_NAME = 'keys';

// --- IndexedDB Helpers ---
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const savePrivateKey = async (key: CryptoKey, userId: string) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(key, `privateKey_${userId}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const loadPrivateKey = async (userId: string): Promise<CryptoKey | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(`privateKey_${userId}`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

// --- ArrayBuffer & Base64 Utils ---
const abToBase64 = (ab: ArrayBuffer): string => {
  const bytes = new Uint8Array(ab);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToAb = (base64: string): ArrayBuffer => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// --- RSA (Asymmetric) Logic ---
export const generateKeyPair = async (): Promise<CryptoKeyPair> => {
  return await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    false, // Private key should ideally be non-extractable, but we need it extractable for IndexedDB sometimes depending on implementation. 
           // Actually IndexedDB can store non-extractable keys via structured clone!
           // But just in case, we make it non-extractable. Wait, Firefox requires it to be extractable if storing in IndexedDB? No, IndexedDB supports non-extractable.
           // However, to be safe across browsers, we use false for non-extractable private.
    ['encrypt', 'decrypt']
  ) as CryptoKeyPair;
};

export const exportPublicKey = async (key: CryptoKey): Promise<string> => {
  const exported = await window.crypto.subtle.exportKey('spki', key);
  return abToBase64(exported);
};

export const importPublicKey = async (base64: string): Promise<CryptoKey> => {
  const ab = base64ToAb(base64);
  return await window.crypto.subtle.importKey(
    'spki',
    ab,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
};

export const encryptSymmetricKey = async (symKey: CryptoKey, publicKey: CryptoKey): Promise<string> => {
  const exportedSymKey = await window.crypto.subtle.exportKey('raw', symKey);
  const encryptedSymKey = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    exportedSymKey
  );
  return abToBase64(encryptedSymKey);
};

export const decryptSymmetricKey = async (encryptedBase64: string, privateKey: CryptoKey): Promise<CryptoKey> => {
  const encryptedAb = base64ToAb(encryptedBase64);
  const decryptedRaw = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedAb
  );
  return await window.crypto.subtle.importKey(
    'raw',
    decryptedRaw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

// --- AES (Symmetric) Logic ---
export const generateSymmetricKey = async (): Promise<CryptoKey> => {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
};

export const encryptMessageText = async (text: string, symKey: CryptoKey): Promise<{ ciphertext: string, iv: string }> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    symKey,
    encodedText
  );

  return {
    ciphertext: abToBase64(encrypted),
    iv: abToBase64(iv.buffer)
  };
};

export const decryptMessageText = async (ciphertextBase64: string, ivBase64: string, symKey: CryptoKey): Promise<string> => {
  const ciphertextAb = base64ToAb(ciphertextBase64);
  const iv = new Uint8Array(base64ToAb(ivBase64));

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    symKey,
    ciphertextAb
  );

  return new TextDecoder().decode(decrypted);
};
