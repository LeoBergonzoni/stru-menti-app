(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .catch(err => console.warn('[PWA] SW registration failed:', err));
    });
  }
})();