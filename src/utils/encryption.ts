
// Client-side encryption utilities using Web Crypto API

// Derive an AES-GCM key from a user's signature (or high-entropy string)
export async function deriveKeyFromSignature(signature: string, salt: string = 'dashboard-salt'): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(signature),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode(salt),
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

// Encrypt an object/string
export async function encryptData(data: any, key: CryptoKey): Promise<{ cipherText: string; iv: string }> {
    const enc = new TextEncoder();
    const json = JSON.stringify(data);
    const encoded = enc.encode(json);

    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes IV for AES-GCM
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
        },
        key,
        encoded
    );

    return {
        cipherText: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv.buffer),
    };
}

// Decrypt data
export async function decryptData(cipherText: string, iv: string, key: CryptoKey): Promise<any> {
    const encryptedParams = base64ToArrayBuffer(cipherText);
    const ivParams = base64ToArrayBuffer(iv);

    try {
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: ivParams,
            },
            key,
            encryptedParams
        );

        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decrypted));
    } catch (e) {
        console.error('Decryption failed:', e);
        throw new Error('Failed to decrypt data. Key might be incorrect.');
    }
}

// Helpers
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}
