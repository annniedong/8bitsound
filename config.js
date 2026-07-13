// On localhost the express server handles /api/chat directly.
// For production (GitHub Pages), set this to your Vercel deployment URL.
window.CHAT_API_URL = location.hostname === 'localhost'
  ? '/api/chat'
  : 'https://8bitsound.vercel.app/api/chat';

window.STUDY_API_URL = location.hostname === 'localhost'
  ? '/api/study'
  : 'https://8bitsound.vercel.app/api/study';

window.PIXEL_API_URL = location.hostname === 'localhost'
  ? '/api/pixel-assistant'
  : 'https://8bitsound.vercel.app/api/pixel-assistant';
