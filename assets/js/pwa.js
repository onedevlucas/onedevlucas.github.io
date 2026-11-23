(function initializeBORailPwa() {
  'use strict';
  const key = 'borailSplashSeen';
  const isReload = performance.getEntriesByType?.('navigation')?.[0]?.type === 'reload';
  let showSplash = true;
  try {
    showSplash = isReload || sessionStorage.getItem(key) !== 'true';
    sessionStorage.setItem(key, 'true');
  } catch { /* storage is optional */ }
  if (showSplash) {
    const splash = document.createElement('div');
    splash.id = 'splash-screen';
    splash.setAttribute('role', 'status');
    splash.innerHTML = '<img id="splash-logo" src="assets/images/branding/borail-logo.png" alt="BORail"><div id="splash-version">V83 - 11/22/26</div>';
    document.body.prepend(splash);
    const remove = () => {
      if (!splash.isConnected) return;
      splash.remove();
      document.dispatchEvent(new Event('borail:splashend'));
    };
    splash.addEventListener('animationend', event => {
      if (event.target === splash) remove();
    });
    window.setTimeout(remove, 4500);
  }
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(error => {
      console.warn('BORail offline service could not start.', error);
    });
  }, { once: true });
})();
