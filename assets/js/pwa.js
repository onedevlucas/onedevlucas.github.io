(function initializeBORailPwa() {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(error => {
      console.warn('BORail offline service could not start.', error);
    });
  }, { once: true });
})();
