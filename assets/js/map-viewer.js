(function initializeMapViewer() {
  'use strict';
  const maps = {
    rush: { title: 'Rush Hour Map', file: 'borail-flatlands-rush-hour-map' },
    regular: { title: 'Regular Service Map', file: 'borail-flatlands-regular-service-map' },
    winter: { title: 'Winter Emergency Map', file: 'borail-flatlands-winter-emergency-map' },
    route: { title: 'Route Map', file: 'borail-flatlands-route-map' }
  };
  const map = maps[new URLSearchParams(location.search).get('map')] || maps.route;
  const viewport = document.getElementById('mapViewport');
  const image = document.getElementById('mapImage');
  const loading = document.getElementById('mapLoading');
  const zoomIn = document.getElementById('mapZoomIn');
  const zoomOut = document.getElementById('mapZoomOut');
  const fitButton = document.getElementById('mapFit');
  const level = document.getElementById('mapZoomLevel');
  document.title = `BORail - ${map.title}`;
  document.getElementById('mapTitle').textContent = map.title;
  document.getElementById('downloadMap').href = 'assets/maps/' + map.file + '.pdf';
  image.alt = `BORail ${map.title}`;

  let ready = false;
  let zoom = 1;
  let fitScale = 1;
  let x = 0;
  let y = 0;
  const pointers = new Map();
  let gesture = null;
  const dimensions = () => ({ width: image.naturalWidth * fitScale * zoom, height: image.naturalHeight * fitScale * zoom });
  function paint() {
    const { width, height } = dimensions();
    x = width <= viewport.clientWidth ? (viewport.clientWidth - width) / 2 : Math.min(0, Math.max(viewport.clientWidth - width, x));
    y = height <= viewport.clientHeight ? (viewport.clientHeight - height) / 2 : Math.min(0, Math.max(viewport.clientHeight - height, y));
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
    image.style.transform = `translate(${x}px, ${y}px)`;
    level.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom <= 1;
    zoomIn.disabled = zoom >= 12;
  }
  function fit() {
    if (!ready) return;
    fitScale = Math.min(viewport.clientWidth / image.naturalWidth, viewport.clientHeight / image.naturalHeight);
    zoom = 1;
    x = y = 0;
    paint();
  }
  function setZoom(next, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2) {
    if (!ready) return;
    const previous = zoom;
    zoom = Math.max(1, Math.min(12, next));
    x = anchorX - (anchorX - x) * zoom / previous;
    y = anchorY - (anchorY - y) * zoom / previous;
    paint();
  }
  function point(event) {
    const rect = viewport.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function resetGesture() {
    const values = [...pointers.values()];
    if (values.length >= 2) {
      const [a, b] = values;
      gesture = { type: 'pinch', distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, zoom, x, y };
    } else if (values.length) gesture = { type: 'pan', point: values[0], x, y };
    else gesture = null;
  }
  viewport.addEventListener('pointerdown', event => {
    if (!ready) return;
    pointers.set(event.pointerId, point(event));
    viewport.setPointerCapture(event.pointerId);
    resetGesture();
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, point(event));
    event.preventDefault();
    if (gesture.type === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      zoom = Math.max(1, Math.min(12, gesture.zoom * Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance));
      x = (a.x + b.x) / 2 - (gesture.center.x - gesture.x) * zoom / gesture.zoom;
      y = (a.y + b.y) / 2 - (gesture.center.y - gesture.y) * zoom / gesture.zoom;
    } else {
      const current = pointers.values().next().value;
      x = gesture.x + current.x - gesture.point.x;
      y = gesture.y + current.y - gesture.point.y;
    }
    paint();
  });
  function release(event) { pointers.delete(event.pointerId); resetGesture(); }
  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', release);
  viewport.addEventListener('wheel', event => {
    if (!ready) return;
    event.preventDefault();
    const anchor = point(event);
    setZoom(zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2), anchor.x, anchor.y);
  }, { passive: false });
  viewport.addEventListener('dblclick', event => { const anchor = point(event); setZoom(zoom * 1.5, anchor.x, anchor.y); });
  zoomIn.addEventListener('click', () => setZoom(zoom * 1.4));
  zoomOut.addEventListener('click', () => setZoom(zoom / 1.4));
  fitButton.addEventListener('click', fit);
  viewport.addEventListener('keydown', event => {
    if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); setZoom(zoom * (event.key === '-' ? 1 / 1.4 : 1.4)); }
    if (event.key === 'Escape') location.href = 'map.html';
  });
  new ResizeObserver(fit).observe(viewport);
  image.addEventListener('load', () => {
    ready = true;
    image.hidden = false;
    loading.hidden = true;
    viewport.setAttribute('aria-busy', 'false');
    fitButton.disabled = false;
    fit();
  });
  image.addEventListener('error', () => {
    loading.textContent = 'The map could not load. Return to Maps and try again, or use Download PDF.';
    viewport.setAttribute('aria-busy', 'false');
  });
  image.src = 'assets/maps/' + map.file + '.png';
})();
