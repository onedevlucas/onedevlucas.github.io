(function() {
  'use strict';

  const AUTO_INTERVAL_MS = 5000;
  const MANUAL_PAUSE_MS = 10000;
  const root = document.getElementById('adCarousel');
  const track = document.getElementById('adCarouselTrack');
  const previousButton = document.getElementById('adCarouselPrevious');
  const nextButton = document.getElementById('adCarouselNext');
  const status = document.getElementById('adCarouselStatus');
  if (!root || !track || !previousButton || !nextButton || !status) return;

  let advertisements = [];
  let activeIndex = 0;
  let autoTimer = 0;
  let resumeTimer = 0;
  let manuallyPaused = false;

  function clearTimers() {
    window.clearTimeout(autoTimer);
    window.clearTimeout(resumeTimer);
    autoTimer = 0;
    resumeTimer = 0;
  }

  function showAdvertisement(index, announce = false) {
    if (!advertisements.length) return;
    activeIndex = (index + advertisements.length) % advertisements.length;
    track.style.transform = `translateX(-${activeIndex * 100}%)`;
    Array.from(track.children).forEach((slide, slideIndex) => {
      const active = slideIndex === activeIndex;
      slide.setAttribute('aria-hidden', String(!active));
      const link = slide.querySelector('a');
      if (link) link.tabIndex = active ? 0 : -1;
    });
    status.textContent = `Advertisement ${activeIndex + 1} of ${advertisements.length}`;
    status.setAttribute('aria-live', announce ? 'polite' : 'off');
  }

  function scheduleAutomaticAdvance() {
    window.clearTimeout(autoTimer);
    if (advertisements.length < 2 || document.hidden || manuallyPaused) return;
    autoTimer = window.setTimeout(() => {
      showAdvertisement(activeIndex + 1);
      scheduleAutomaticAdvance();
    }, AUTO_INTERVAL_MS);
  }

  function manuallyAdvance(direction) {
    clearTimers();
    manuallyPaused = true;
    showAdvertisement(activeIndex + direction, true);
    resumeTimer = window.setTimeout(() => {
      manuallyPaused = false;
      showAdvertisement(activeIndex + 1);
      scheduleAutomaticAdvance();
    }, MANUAL_PAUSE_MS);
  }

  function buildSlide(advertisement, index) {
    const slide = document.createElement('div');
    slide.className = 'ad-carousel-slide';
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${index + 1} of ${advertisements.length}`);

    const image = document.createElement('img');
    image.src = `assets/images/ads/carousel/${encodeURIComponent(advertisement.file)}`;
    image.alt = advertisement.alt || 'Advertisement';
    image.width = 320;
    image.height = 64;

    if (advertisement.href) {
      const link = document.createElement('a');
      link.href = advertisement.href;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', image.alt);
      link.appendChild(image);
      slide.appendChild(link);
    } else {
      slide.appendChild(image);
    }
    return slide;
  }

  function initialize(items) {
    advertisements = items.filter(item => item && typeof item.file === 'string' && item.file.toLowerCase().endsWith('.png'));
    if (!advertisements.length) {
      root.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();
    advertisements.forEach((advertisement, index) => fragment.appendChild(buildSlide(advertisement, index)));
    track.replaceChildren(fragment);
    const hasMultiple = advertisements.length > 1;
    previousButton.hidden = !hasMultiple;
    nextButton.hidden = !hasMultiple;
    showAdvertisement(0);
    root.classList.add('ready');
    scheduleAutomaticAdvance();
  }

  previousButton.addEventListener('click', () => manuallyAdvance(-1));
  nextButton.addEventListener('click', () => manuallyAdvance(1));
  root.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') manuallyAdvance(-1);
    if (event.key === 'ArrowRight') manuallyAdvance(1);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(autoTimer);
      autoTimer = 0;
    } else if (!manuallyPaused) {
      scheduleAutomaticAdvance();
    }
  });

  window.BORailAdCarouselDebug = {
    getState: () => ({
      activeIndex,
      count: advertisements.length,
      manuallyPaused,
      autoIntervalMs: AUTO_INTERVAL_MS,
      manualPauseMs: MANUAL_PAUSE_MS
    })
  };

  fetch('assets/images/ads/carousel/manifest.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`Advertisement manifest returned ${response.status}`);
      return response.json();
    })
    .then(initialize)
    .catch(() => { root.hidden = true; });
})();
