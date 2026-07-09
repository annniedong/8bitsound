// On localhost the express server handles /api/chat directly.
// For production (GitHub Pages), set this to your Vercel deployment URL.
window.CHAT_API_URL = location.hostname === 'localhost'
  ? '/api/chat'
  : 'https://8bitsound.vercel.app/api/chat';
