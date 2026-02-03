import React from 'react';
import { DashboardGrid } from './components/layout/DashboardGrid';
import { CalendarWidget } from './components/widgets/CalendarWidget';
import { TodoWidget } from './components/widgets/TodoWidget';
import { BookmarkWidget } from './components/widgets/BookmarkWidget';
import { ReadingWidget } from './components/widgets/ReadingWidget';

// Define the default layout mapping indices to widgets based on render order below
const defaultLayout = [
  // 1. CalendarWidget (Index 0) - Left, 50% width
  { i: 'calendar', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
  // 2. TodoWidget (Index 1) - Middle, 25% width
  { i: 'todo', x: 6, y: 0, w: 3, h: 6, minW: 3, minH: 3 },
  // 3. ReadingWidget (Index 2) - Right, 25% width
  { i: 'reading', x: 9, y: 0, w: 3, h: 6, minW: 2, minH: 2 },
  // 4. BookmarkWidget (Index 3) - Bottom, 100% width
  { i: 'bookmark', x: 0, y: 6, w: 12, h: 2, minW: 4, minH: 2 },
];

import { useState, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { deriveKeyFromSignature, encryptData } from './utils/encryption';

function App() {
  const [bgImage, setBgImage] = useLocalStorage<string>('dashboard_bg_image', '/macos-wallpaper.jpg');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Privy Auth
  const { login, logout, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'encrypting' | 'uploading' | 'done' | 'error'>('idle');

  // Encryption & Sync Link
  const handleSync = async () => {
    if (!authenticated || wallets.length === 0) {
      alert('Please login and connect a wallet first to sign for encryption.');
      return;
    }

    try {
      setSyncStatus('encrypting');

      // 1. Request Signature/Message to derive key
      // NOTE: In a real app, use a deterministic message like "Login to Aeri Dashboard"
      const message = "Allow Aeri Dashboard to access your encrypted storage.";
      const wallet = wallets[0]; // Use primary wallet
      const signature = await wallet.sign(message);

      // 2. Derive Key
      const key = await deriveKeyFromSignature(signature, user?.id || 'default-salt');

      // 3. Collect Data
      const allData = {
        todos: localStorage.getItem('todos'),
        readings: localStorage.getItem('readings'),
        bookmarks: localStorage.getItem('bookmarks'),
        calendar: localStorage.getItem('calendar-events'),
        settings: { bgImage } // Include settings
      };

      // 4. Encrypt
      const { cipherText, iv } = await encryptData(allData, key);

      setSyncStatus('uploading');

      // 5. Simulate Upload (Since no DB connected yet)
      console.log(">> ENCRYPTED BLOB READY FOR DB <<");
      console.log("User ID:", user?.id);
      console.log("IV:", iv);
      console.log("CipherText Length:", cipherText.length);
      console.log("CipherText Sample:", cipherText.substring(0, 50) + "...");

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSyncStatus('done');
      alert(`Encrypted Backup Created! \n(Check Console for Blob)\nUser: ${user?.id}`);

    } catch (e) {
      console.error(e);
      setSyncStatus('error');
      alert('Encryption Failed: ' + (e as any).message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBgImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFullReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    // Clear all app data
    localStorage.removeItem('todos');
    localStorage.removeItem('readings');
    localStorage.removeItem('bookmarks');
    localStorage.removeItem('calendar-events');

    // Reset background
    setBgImage('/macos-wallpaper.jpg');

    // Reload to apply changes and clear state
    window.location.reload();
  };

  return (
    <div
      className="min-h-screen bg-center bg-fixed bg-no-repeat text-white overflow-hidden transition-all duration-500"
      style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: 'auto 100%'
      }}
    >
      {/* Settings Button (Top Right) */}
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="fixed top-4 right-4 z-[9999] p-2 bg-black/20 hover:bg-black/40 text-white/50 hover:text-white rounded-full backdrop-blur-sm transition-all shadow-lg"
        title="Settings"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-md"
          onClick={() => setShowResetConfirm(false)}>
          <div className="bg-[#1e1e1e] border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-2">Are you sure?</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              This action cannot be undone. This will permanently delete your <span className="text-red-400">Todo tasks, Bookmarks, and Calendar events</span> and reset all settings to default.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors shadow-lg shadow-red-500/20"
              >
                Yes, Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setIsSettingsOpen(false)}>
          <div
            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 overflow-visible shadow-2xl relative animate-scale-in">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-2 right-2 p-2 text-white/50 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-4">Settings</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Background Image</label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm transition-colors"
                  >
                    Generate from Upload File...
                  </button>
                  <p className="text-xs text-center text-white/40">- or -</p>
                  <input
                    type="text"
                    placeholder="Paste Image URL..."
                    value={bgImage.startsWith('data:') ? '' : bgImage}
                    onChange={(e) => setBgImage(e.target.value)}
                    className="w-full py-2 px-3 bg-black/20 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </div>

            {/* Account & Security Section */}
            <div className="pt-2 border-t border-white/10">
              <label className="block text-sm font-medium text-white/80 mb-2">Account & Security</label>
              {!authenticated ? (
                <button
                  onClick={login}
                  className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Login with Privy
                  <span className="text-xs opacity-50">(Encrypted Sync)</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-white/50 break-all bg-black/30 p-2 rounded-lg">
                    User: {user?.email?.address || user?.wallet?.address || user?.id}
                  </div>
                  <button
                    onClick={handleSync}
                    disabled={syncStatus === 'encrypting' || syncStatus === 'uploading'}
                    className="w-full py-2 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {syncStatus === 'encrypting' ? 'Encrypting...' :
                      syncStatus === 'uploading' ? 'Uploading...' :
                        syncStatus === 'done' ? 'Synced (Encrypted)' : 'Sync to Cloud'}
                  </button>
                  <button
                    onClick={logout}
                    className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-sm transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/10">
              <button
                onClick={handleFullReset}
                className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-xl text-sm transition-colors"
              >
                Reset All Data
              </button>
            </div>

            <div className="pt-2 border-t border-white/10">
              <label className="block text-sm font-medium text-white/80 mb-2">Donate to Creator</label>
              <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl">
                <span className="text-xs text-white/60 font-mono flex-1 truncate text-center">
                  0x2ddb...77003c
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('0x2ddb9f0dfc20a230369ebeb8cd3f0b285977003c');
                    alert('Address copied!');
                  }}
                  className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Copy Address"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DashboardGrid defaultLayout={defaultLayout}>
        <CalendarWidget />
        <TodoWidget />
        <ReadingWidget />
        <BookmarkWidget />
      </DashboardGrid>
    </div>
  );
}

export default App;
