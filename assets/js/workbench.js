(function() {
  'use strict';

  const Core = window.BORailWorkbench;
  const STORAGE_KEY = 'borail-architect-workbench-world-v1';
  const MAX_HISTORY = 50;
  const DRAWING_TOOLS = new Set(['rail', 'land', 'water', 'region', 'terrain']);
  const TOOL_HELP = {
    select: ['Select objects', 'Click a station, track, label, or area to edit it. Drag stations and labels to move them.'],
    station: ['Place a station', 'Click the map to add a new Green Line station. Its inspector opens immediately.'],
    rail: ['Draw rail', 'Click to add track points. Double-click, press Enter, or use Finish when the route is complete.'],
    land: ['Draw land', 'Click at least three points to outline land, then finish the shape.'],
    water: ['Draw water', 'Click at least three points to outline water, then finish the shape.'],
    region: ['Draw a region', 'Click at least three points to define a city, district, county, or zone.'],
    label: ['Add a label', 'Click the map to place an editable map label.'],
    terrain: ['Draw terrain', 'Click at least three points to add a practical 2.5D terrain planning zone.']
  };

  const TYPE_CONFIG = {
    station: { collection: 'stations', label: 'Station' },
    railSegment: { collection: 'railSegments', label: 'Rail segment' },
    land: { collection: 'landPolygons', label: 'Land polygon' },
    water: { collection: 'waterPolygons', label: 'Water polygon' },
    region: { collection: 'regions', label: 'Region' },
    label: { collection: 'labels', label: 'Map label' },
    terrain: { collection: 'terrainZones', label: 'Terrain zone' },
    line: { collection: 'lines', label: 'Rail line' }
  };

  const els = {
    workbench: document.getElementById('workbench'),
    map: document.getElementById('mapCanvas'),
    mapFrame: document.getElementById('mapFrame'),
    terrainLayer: document.getElementById('terrainLayer'),
    landLayer: document.getElementById('landLayer'),
    waterLayer: document.getElementById('waterLayer'),
    regionLayer: document.getElementById('regionLayer'),
    railLayer: document.getElementById('railLayer'),
    labelLayer: document.getElementById('labelLayer'),
    stationLayer: document.getElementById('stationLayer'),
    drawingLayer: document.getElementById('drawingLayer'),
    inspectorHeading: document.getElementById('inspectorHeading'),
    inspectorContent: document.getElementById('inspectorContent'),
    bottomContent: document.getElementById('bottomContent'),
    bottomPanel: document.getElementById('bottomPanel'),
    issueCountBadge: document.getElementById('issueCountBadge'),
    modeStatus: document.getElementById('modeStatus'),
    coordinateStatus: document.getElementById('coordinateStatus'),
    worldNameDisplay: document.getElementById('worldNameDisplay'),
    toolHelpTitle: document.getElementById('toolHelpTitle'),
    toolHelpText: document.getElementById('toolHelpText'),
    drawingActions: document.getElementById('drawingActions'),
    finishDrawingButton: document.getElementById('finishDrawingButton'),
    cancelDrawingButton: document.getElementById('cancelDrawingButton'),
    undoButton: document.getElementById('undoButton'),
    redoButton: document.getElementById('redoButton'),
    validateButton: document.getElementById('validateButton'),
    saveButton: document.getElementById('saveButton'),
    importButton: document.getElementById('importButton'),
    importFile: document.getElementById('importFile'),
    exportButton: document.getElementById('exportButton'),
    resetButton: document.getElementById('resetButton'),
    zoomInButton: document.getElementById('zoomInButton'),
    zoomOutButton: document.getElementById('zoomOutButton'),
    fitButton: document.getElementById('fitButton'),
    stationSearch: document.getElementById('stationSearch'),
    greenLineFilter: document.getElementById('greenLineFilter'),
    bottomCollapseButton: document.getElementById('bottomCollapseButton'),
    toastRegion: document.getElementById('toastRegion')
  };

  const state = {
    world: loadWorld(),
    mode: 'architect',
    tool: 'select',
    selected: null,
    drawingPoints: [],
    pointerWorld: null,
    undoStack: [],
    redoStack: [],
    validation: [],
    bottomTab: 'validation',
    viewBox: { x: 0, y: 0, width: Core.WORLD_WIDTH, height: Core.WORLD_HEIGHT },
    pan: null,
    drag: null,
    greenVisible: true,
    saveTimer: null
  };

  function loadWorld() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return Core.createSeedWorld();
      const parsed = JSON.parse(stored);
      const blockingIssues = Core.validateWorld(parsed).filter(issue => issue.severity === 'error');
      return blockingIssues.length ? Core.createSeedWorld() : parsed;
    } catch (error) {
      return Core.createSeedWorld();
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function escapeXml(value) {
    return escapeHtml(value);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundCoord(value) {
    return Math.round(Number(value) || 0);
  }

  function pathData(points) {
    return (points || []).map((point, index) => `${index ? 'L' : 'M'} ${roundCoord(point.x)} ${roundCoord(point.y)}`).join(' ');
  }

  function polygonPoints(points) {
    return (points || []).map(point => `${roundCoord(point.x)},${roundCoord(point.y)}`).join(' ');
  }

  function selectedClass(type, id) {
    return state.selected && state.selected.type === type && state.selected.id === id ? ' selected' : '';
  }

  function getCollection(type) {
    const config = TYPE_CONFIG[type];
    return config ? state.world[config.collection] : null;
  }

  function getObject(type, id) {
    const collection = getCollection(type);
    return collection ? collection.find(item => item.id === id) : null;
  }

  function getSelectedObject() {
    return state.selected ? getObject(state.selected.type, state.selected.id) : null;
  }

  function getLine(lineId) {
    return state.world.lines.find(line => line.id === lineId) || state.world.lines[0];
  }

  function logAction(action) {
    state.world.changeLog = state.world.changeLog || [];
    state.world.changeLog.unshift({
      id: Core.makeId('change', new Set(state.world.changeLog.map(entry => entry.id))),
      at: new Date().toISOString(),
      action
    });
    state.world.changeLog = state.world.changeLog.slice(0, 100);
  }

  function pushHistory() {
    state.undoStack.push(Core.deepClone(state.world));
    if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
    state.redoStack.length = 0;
    updateUndoRedoButtons();
  }

  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(Core.deepClone(state.world));
    state.world = state.undoStack.pop();
    state.selected = null;
    state.drawingPoints = [];
    afterWorldChange(false);
    toast('Undid the last change.');
  }

  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(Core.deepClone(state.world));
    state.world = state.redoStack.pop();
    state.selected = null;
    state.drawingPoints = [];
    afterWorldChange(false);
    toast('Redid the change.');
  }

  function updateUndoRedoButtons() {
    els.undoButton.disabled = !state.undoStack.length || state.mode !== 'architect';
    els.redoButton.disabled = !state.redoStack.length || state.mode !== 'architect';
  }

  function scheduleSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => saveDraft(false), 250);
  }

  function saveDraft(notify = true) {
    try {
      state.world.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.world));
      if (notify) toast('Draft saved on this device.');
    } catch (error) {
      toast('The draft could not be saved in this browser.', 'error');
    }
  }

  function afterWorldChange(runValidation = true) {
    state.world.updatedAt = new Date().toISOString();
    if (runValidation) state.validation = Core.validateWorld(state.world);
    renderAll();
    scheduleSave();
  }

  function toast(message, type) {
    const node = document.createElement('div');
    node.className = `toast${type ? ` ${type}` : ''}`;
    node.textContent = message;
    els.toastRegion.appendChild(node);
    setTimeout(() => node.remove(), 3200);
  }

  function setTool(tool) {
    if (state.mode !== 'architect') return;
    state.tool = tool;
    state.drawingPoints = [];
    state.pointerWorld = null;
    document.querySelectorAll('.tool').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
    els.map.className.baseVal = `tool-${tool}`;
    els.toolHelpTitle.textContent = TOOL_HELP[tool][0];
    els.toolHelpText.textContent = TOOL_HELP[tool][1];
    els.drawingActions.hidden = !DRAWING_TOOLS.has(tool);
    renderDrawing();
  }

  function setMode(mode) {
    state.mode = mode;
    state.tool = 'select';
    state.drawingPoints = [];
    state.pointerWorld = null;
    state.selected = null;
    els.workbench.classList.toggle('preview-mode', mode === 'preview');
    document.querySelectorAll('.mode-button').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
    document.querySelectorAll('.preview-only').forEach(element => { element.hidden = mode !== 'preview'; });
    els.modeStatus.textContent = mode === 'preview' ? 'Public Preview Mode' : 'Architect Mode';
    document.querySelectorAll('.tool').forEach(button => button.classList.toggle('active', button.dataset.tool === 'select'));
    els.map.className.baseVal = 'tool-select';
    renderAll();
  }

  function applyViewBox() {
    const box = state.viewBox;
    els.map.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  }

  function fitWorld() {
    state.viewBox = { x: 0, y: 0, width: Core.WORLD_WIDTH, height: Core.WORLD_HEIGHT };
    applyViewBox();
  }

  function zoom(factor, center) {
    const box = state.viewBox;
    const minWidth = 1800;
    const maxWidth = Core.WORLD_WIDTH * 1.25;
    const newWidth = clamp(box.width * factor, minWidth, maxWidth);
    const ratio = newWidth / box.width;
    const newHeight = newWidth * Core.WORLD_HEIGHT / Core.WORLD_WIDTH;
    const target = center || { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    state.viewBox = {
      x: target.x - (target.x - box.x) * ratio,
      y: target.y - (target.y - box.y) * ratio,
      width: newWidth,
      height: newHeight
    };
    applyViewBox();
  }

  function centerOn(point, width = 3200) {
    const height = width * Core.WORLD_HEIGHT / Core.WORLD_WIDTH;
    state.viewBox = { x: point.x - width / 2, y: point.y - height / 2, width, height };
    applyViewBox();
  }

  function eventPoint(event) {
    const point = els.map.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = els.map.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const mapped = point.matrixTransform(matrix.inverse());
    return {
      x: clamp(roundCoord(mapped.x), 0, state.world.settings.worldWidth),
      y: clamp(roundCoord(mapped.y), 0, state.world.settings.worldHeight)
    };
  }

  function renderAll() {
    els.worldNameDisplay.textContent = state.world.name;
    els.coordinateStatus.textContent = `BoRail XY • ${state.world.settings.worldWidth.toLocaleString()} × ${state.world.settings.worldHeight.toLocaleString()}`;
    renderMap();
    renderInspector();
    renderBottom();
    updateUndoRedoButtons();
  }

  function renderMap() {
    const lineVisible = state.mode !== 'preview' || state.greenVisible;
    els.terrainLayer.innerHTML = state.world.terrainZones.map(zone => `
      <polygon class="map-object terrain-shape ${escapeXml(zone.terrainType)}${selectedClass('terrain', zone.id)}"
        points="${polygonPoints(zone.polygon)}" data-object-type="terrain" data-object-id="${escapeXml(zone.id)}"></polygon>
    `).join('');

    els.landLayer.innerHTML = state.world.landPolygons.map(land => `
      <polygon class="map-object land-shape ${escapeXml(land.landType)}${selectedClass('land', land.id)}"
        points="${polygonPoints(land.polygon)}" data-object-type="land" data-object-id="${escapeXml(land.id)}"></polygon>
    `).join('');

    els.waterLayer.innerHTML = state.world.waterPolygons.map(water => `
      <polygon class="map-object water-shape ${escapeXml(water.waterType)}${selectedClass('water', water.id)}"
        points="${polygonPoints(water.polygon)}" data-object-type="water" data-object-id="${escapeXml(water.id)}"></polygon>
    `).join('');

    els.regionLayer.innerHTML = state.world.regions.map(region => `
      <polygon class="map-object region-shape ${escapeXml(region.regionType)}${selectedClass('region', region.id)}"
        points="${polygonPoints(region.polygon)}" data-object-type="region" data-object-id="${escapeXml(region.id)}"></polygon>
    `).join('');

    els.railLayer.style.display = lineVisible ? '' : 'none';
    els.railLayer.innerHTML = state.world.railSegments.map(segment => {
      const line = getLine(segment.lineIds[0]);
      const d = pathData(segment.path);
      const selected = selectedClass('railSegment', segment.id);
      return `<g class="map-object${selected}" data-object-type="railSegment" data-object-id="${escapeXml(segment.id)}">
        <path class="rail-casing" d="${d}"></path>
        <path class="rail-line ${escapeXml(segment.verticalMode)} ${escapeXml(segment.status)}" d="${d}" style="stroke:${escapeXml(line.color)}"></path>
        <path class="rail-hit" d="${d}"></path>
      </g>`;
    }).join('');

    els.labelLayer.innerHTML = state.world.labels.map(label => `
      <g class="map-object label-object${selectedClass('label', label.id)}" transform="translate(${roundCoord(label.position.x)} ${roundCoord(label.position.y)})"
        data-object-type="label" data-object-id="${escapeXml(label.id)}">
        <text class="map-label ${escapeXml(label.labelType)}" text-anchor="middle">${escapeXml(label.text)}</text>
      </g>
    `).join('');

    els.stationLayer.style.display = lineVisible ? '' : 'none';
    els.stationLayer.innerHTML = state.world.stations.map(station => {
      const meta = [station.stationType === 'terminal' ? 'Terminal' : station.stationType === 'transfer' ? 'Transfer' : 'Local'];
      if (station.accessible) meta.push('Accessible');
      return `<g class="map-object station-group ${escapeXml(station.stationType)}${selectedClass('station', station.id)}"
          transform="translate(${roundCoord(station.position.x)} ${roundCoord(station.position.y)})"
          data-object-type="station" data-object-id="${escapeXml(station.id)}">
        <circle class="station-halo" r="155"></circle>
        <circle class="station-dot" r="84"></circle>
        <circle class="station-core" r="26"></circle>
        ${station.accessible ? '<circle class="accessible-mark" cx="70" cy="-70" r="24"></circle>' : ''}
        <text class="station-name" x="135" y="-18">${escapeXml(station.name)}</text>
        <text class="station-meta" x="137" y="98">${escapeXml(meta.join(' • '))}</text>
      </g>`;
    }).join('');

    renderDrawing();
  }

  function renderDrawing() {
    if (!state.drawingPoints.length) {
      els.drawingLayer.innerHTML = '';
      return;
    }
    const points = [...state.drawingPoints];
    if (state.pointerWorld) points.push(state.pointerWorld);
    const isPolygon = state.tool !== 'rail';
    const shape = isPolygon
      ? `<polygon class="drawing-preview" points="${polygonPoints(points)}"></polygon>`
      : `<path class="drawing-preview" d="${pathData(points)}"></path>`;
    const pointsMarkup = state.drawingPoints.map(point => `<circle class="drawing-point" cx="${point.x}" cy="${point.y}" r="48"></circle>`).join('');
    els.drawingLayer.innerHTML = shape + pointsMarkup;
  }

  function renderInspector() {
    const object = getSelectedObject();
    if (state.mode === 'preview') {
      renderPreviewInspector(object);
      return;
    }
    els.inspectorHeading.textContent = object ? TYPE_CONFIG[state.selected.type].label : 'World inspector';
    if (!object) {
      els.inspectorContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">A</div>
          <strong>${escapeHtml(state.world.name)}</strong>
          <p>Select an object on the map or choose a build tool. This starter world includes all 10 Green Line (A) local stations.</p>
        </div>
        <div class="form-section">
          <label class="field"><span>World name</span><input data-world-field="name" value="${escapeHtml(state.world.name)}"></label>
          <label class="field"><span>Description</span><textarea data-world-field="description">${escapeHtml(state.world.description || '')}</textarea></label>
          <div class="line-assignment"><img src="assets/images/line-icons/a-local.png" alt=""><div><strong>Green Line (A)</strong><br><small>Newkirk ↔ Mount River</small></div></div>
        </div>`;
      return;
    }

    const title = object.name || object.text || TYPE_CONFIG[state.selected.type].label;
    const commonHeader = `<div class="object-header"><div><span class="object-type">${escapeHtml(TYPE_CONFIG[state.selected.type].label)}</span><h2>${escapeHtml(title)}</h2></div><span class="object-id">${escapeHtml(object.id)}</span></div>`;
    let fields = '';
    if (state.selected.type === 'station') fields = stationFields(object);
    if (state.selected.type === 'railSegment') fields = railFields(object);
    if (['land', 'water', 'region', 'terrain'].includes(state.selected.type)) fields = polygonFields(state.selected.type, object);
    if (state.selected.type === 'label') fields = labelFields(object);
    els.inspectorContent.innerHTML = commonHeader + fields + `<div class="danger-zone"><button class="button danger-quiet" id="deleteSelectedButton">Delete ${escapeHtml(TYPE_CONFIG[state.selected.type].label)}</button></div>`;
  }

  function lineAssignment(object) {
    const line = state.world.lines[0];
    return `<div class="line-assignment"><img src="assets/images/line-icons/a-local.png" alt="Green Line"><div><strong>${escapeHtml(line.name)} (${escapeHtml(line.shortName)})</strong><br><small>Local service</small></div><input type="checkbox" data-line-toggle="${escapeHtml(line.id)}" ${object.lineIds.includes(line.id) ? 'checked' : ''}></div>`;
  }

  function optionList(values, selected) {
    return values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value.replace(/-/g, ' '))}</option>`).join('');
  }

  function stationFields(station) {
    return `<div class="form-section">
      <div class="section-label">Identity</div>
      <label class="field"><span>Name</span><input data-field="name" value="${escapeHtml(station.name)}"></label>
      <label class="field"><span>Slug</span><input data-field="slug" value="${escapeHtml(station.slug)}"></label>
      <div class="field-row">
        <label class="field"><span>BoRail X</span><input type="number" data-field="position.x" value="${station.position.x}"></label>
        <label class="field"><span>BoRail Y</span><input type="number" data-field="position.y" value="${station.position.y}"></label>
      </div>
    </div>
    <div class="form-section"><div class="section-label">Line assignment</div>${lineAssignment(station)}</div>
    <div class="form-section">
      <div class="section-label">Passenger information</div>
      <label class="check-field"><input type="checkbox" data-field="accessible" ${station.accessible ? 'checked' : ''}> Accessible station</label>
      <label class="check-field"><input type="checkbox" data-field="expressStop" ${station.expressStop ? 'checked' : ''}> Express stop</label>
      <label class="field"><span>Station type</span><select data-field="stationType">${optionList(['local','express','terminal','transfer','yard','depot'], station.stationType)}</select></label>
      <label class="field"><span>Status</span><select data-field="status">${optionList(['active','planned','closed'], station.status)}</select></label>
      <label class="field"><span>Notes</span><textarea data-field="notes">${escapeHtml(station.notes || '')}</textarea></label>
    </div>`;
  }

  function railFields(segment) {
    const stationOptions = `<option value="">Not associated</option>` + state.world.stations.map(station => `<option value="${escapeHtml(station.id)}">${escapeHtml(station.name)}</option>`).join('');
    return `<div class="form-section">
      <label class="field"><span>Name</span><input data-field="name" value="${escapeHtml(segment.name || '')}"></label>
      <div class="section-label">Line assignment</div>${lineAssignment(segment)}
    </div>
    <div class="form-section">
      <label class="field"><span>Vertical mode</span><select data-field="verticalMode">${optionList(['surface','elevated','bridge','tunnel','underground','cutting','embankment'], segment.verticalMode)}</select></label>
      <label class="field"><span>Track type</span><select data-field="trackType">${optionList(['mainline','branch','yard','siding','service'], segment.trackType)}</select></label>
      <label class="field"><span>Status</span><select data-field="status">${optionList(['active','planned','closed'], segment.status)}</select></label>
      <label class="field"><span>From station</span><select data-field="fromStationId">${stationOptions.replace(`value="${escapeHtml(segment.fromStationId || '')}"`, `value="${escapeHtml(segment.fromStationId || '')}" selected`)}</select></label>
      <label class="field"><span>To station</span><select data-field="toStationId">${stationOptions.replace(`value="${escapeHtml(segment.toStationId || '')}"`, `value="${escapeHtml(segment.toStationId || '')}" selected`)}</select></label>
      <label class="field"><span>Notes</span><textarea data-field="notes">${escapeHtml(segment.notes || '')}</textarea></label>
    </div>`;
  }

  function polygonFields(type, object) {
    const typeField = type === 'land' ? 'landType' : type === 'water' ? 'waterType' : type === 'region' ? 'regionType' : 'terrainType';
    const choices = {
      land: ['urban','suburban','rural','park','mountain','industrial','other'],
      water: ['sea','lake','river','canal','bay','harbor'],
      region: ['city','borough','district','county','island','zone'],
      terrain: ['lowland','hill','mountain','valley','ridge','plateau','coastal']
    }[type];
    return `<div class="form-section">
      <label class="field"><span>Name</span><input data-field="name" value="${escapeHtml(object.name || '')}"></label>
      <label class="field"><span>Type</span><select data-field="${typeField}">${optionList(choices, object[typeField])}</select></label>
      ${type === 'terrain' ? `<label class="field"><span>Elevation</span><input type="number" data-field="elevation" value="${object.elevation}"></label>` : ''}
      <div class="fact"><span>Geometry</span><strong>${object.polygon.length} points</strong></div>
    </div>`;
  }

  function labelFields(label) {
    return `<div class="form-section">
      <label class="field"><span>Text</span><input data-field="text" value="${escapeHtml(label.text)}"></label>
      <label class="field"><span>Label type</span><select data-field="labelType">${optionList(['city','region','landmark','water','station-note'], label.labelType)}</select></label>
      <div class="field-row">
        <label class="field"><span>BoRail X</span><input type="number" data-field="position.x" value="${label.position.x}"></label>
        <label class="field"><span>BoRail Y</span><input type="number" data-field="position.y" value="${label.position.y}"></label>
      </div>
    </div>`;
  }

  function renderPreviewInspector(object) {
    els.inspectorHeading.textContent = object && state.selected.type === 'station' ? 'Station information' : 'Public map';
    if (!object || state.selected.type !== 'station') {
      els.inspectorContent.innerHTML = `<div class="empty-state"><div class="empty-icon">A</div><strong>Explore the Green Line</strong><p>Click a station to view rider information. Pan and zoom the fictional Flatlands map freely.</p></div>`;
      return;
    }
    els.inspectorContent.innerHTML = `<div class="station-card">
      <span class="object-type">Green Line station</span><h2>${escapeHtml(object.name)}</h2>
      <div class="line-card"><img src="assets/images/line-icons/a-local.png" alt="Green Line"><div><strong>Green Line (A)</strong><br><small>Local service</small></div></div>
      <div class="facts">
        <div class="fact"><span>Station type</span><strong>${escapeHtml(object.stationType)}</strong></div>
        <div class="fact"><span>Status</span><strong>${escapeHtml(object.status)}</strong></div>
        <div class="fact"><span>Accessibility</span><strong>${object.accessible ? 'Accessible' : 'Not marked'}</strong></div>
        <div class="fact"><span>Service</span><strong>${object.expressStop ? 'Local + Express' : 'Local'}</strong></div>
      </div>
      ${object.notes ? `<p>${escapeHtml(object.notes)}</p>` : ''}
      <div class="future-arrivals"><strong>Live arrivals can connect here later.</strong><br>This preview intentionally does not invent live train data.</div>
    </div>`;
  }

  function renderBottom() {
    const count = state.validation.filter(issue => issue.severity !== 'info').length;
    els.issueCountBadge.textContent = count;
    document.querySelectorAll('.bottom-tab').forEach(button => button.classList.toggle('active', button.dataset.bottomTab === state.bottomTab));
    if (state.bottomTab === 'validation') {
      els.bottomContent.innerHTML = `<div class="issue-list">${state.validation.map(issue => `
        <button class="issue" data-issue-type="${escapeHtml(issue.objectType || '')}" data-issue-id="${escapeHtml(issue.objectId || '')}">
          <span class="severity ${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</span>
          <span class="issue-message">${escapeHtml(issue.message)}</span>
          <span class="issue-code">${escapeHtml(issue.code)}</span>
        </button>`).join('')}</div>`;
    } else if (state.bottomTab === 'changes') {
      els.bottomContent.innerHTML = `<div class="change-list">${(state.world.changeLog || []).slice(0, 20).map(entry => `<div class="change-entry"><span>${escapeHtml(entry.action)}</span><time>${new Date(entry.at).toLocaleString()}</time></div>`).join('')}</div>`;
    } else {
      const stats = [
        ['Stations', state.world.stations.length], ['Lines', state.world.lines.length], ['Rail segments', state.world.railSegments.length],
        ['Land areas', state.world.landPolygons.length], ['Water areas', state.world.waterPolygons.length], ['Regions', state.world.regions.length],
        ['Labels', state.world.labels.length], ['Terrain zones', state.world.terrainZones.length]
      ];
      els.bottomContent.innerHTML = `<div class="stats-grid">${stats.map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`).join('')}</div>`;
    }
  }

  function setSelected(type, id) {
    if (!getObject(type, id)) return;
    state.selected = { type, id };
    renderMap();
    renderInspector();
  }

  function nearestStation(point, maxDistance = 330) {
    let nearest = null;
    let nearestDistance = maxDistance;
    state.world.stations.forEach(station => {
      const distance = Math.hypot(station.position.x - point.x, station.position.y - point.y);
      if (distance < nearestDistance) {
        nearest = station;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  function addStation(point) {
    pushHistory();
    const number = state.world.stations.length + 1;
    const name = `New Station ${number}`;
    const station = {
      id: Core.makeId('station', Core.getAllIds(state.world)),
      name,
      slug: Core.slugify(name),
      position: point,
      lineIds: [state.world.lines[0].id],
      accessible: false,
      expressStop: false,
      status: 'planned',
      stationType: 'local',
      notes: ''
    };
    state.world.stations.push(station);
    state.selected = { type: 'station', id: station.id };
    logAction(`Placed ${name}`);
    afterWorldChange();
  }

  function addLabel(point) {
    pushHistory();
    const label = {
      id: Core.makeId('label', Core.getAllIds(state.world)),
      text: 'NEW LABEL',
      position: point,
      labelType: 'landmark'
    };
    state.world.labels.push(label);
    state.selected = { type: 'label', id: label.id };
    logAction('Added a map label');
    afterWorldChange();
  }

  function finishDrawing() {
    if (!DRAWING_TOOLS.has(state.tool)) return;
    const minimum = state.tool === 'rail' ? 2 : 3;
    const points = state.drawingPoints.filter((point, index, all) => index === 0 || point.x !== all[index - 1].x || point.y !== all[index - 1].y);
    if (points.length < minimum) {
      toast(`Add at least ${minimum} points before finishing.`, 'error');
      return;
    }
    pushHistory();
    const ids = Core.getAllIds(state.world);
    let selection;
    if (state.tool === 'rail') {
      const from = nearestStation(points[0]);
      const to = nearestStation(points[points.length - 1]);
      if (from) points[0] = Core.deepClone(from.position);
      if (to) points[points.length - 1] = Core.deepClone(to.position);
      const segment = {
        id: Core.makeId('segment', ids),
        name: from && to ? `${from.name} to ${to.name}` : 'New Green Line segment',
        lineIds: [state.world.lines[0].id],
        path: points,
        verticalMode: 'surface',
        trackType: 'mainline',
        status: 'planned',
        fromStationId: from ? from.id : '',
        toStationId: to ? to.id : '',
        notes: ''
      };
      state.world.railSegments.push(segment);
      selection = { type: 'railSegment', id: segment.id };
      logAction(`Drew ${segment.name}`);
    } else {
      const config = {
        land: ['landPolygons', 'land', { name: 'New land area', polygon: points, landType: 'suburban' }],
        water: ['waterPolygons', 'water', { name: 'New water area', polygon: points, waterType: 'lake' }],
        region: ['regions', 'region', { name: 'New region', polygon: points, regionType: 'district' }],
        terrain: ['terrainZones', 'terrain', { name: 'New terrain zone', polygon: points, elevation: 100, terrainType: 'hill' }]
      }[state.tool];
      const object = { id: Core.makeId(config[1], ids), ...config[2] };
      state.world[config[0]].push(object);
      selection = { type: config[1], id: object.id };
      logAction(`Drew ${object.name}`);
    }
    state.selected = selection;
    state.drawingPoints = [];
    state.pointerWorld = null;
    setTool('select');
    afterWorldChange();
  }

  function cancelDrawing() {
    state.drawingPoints = [];
    state.pointerWorld = null;
    renderDrawing();
  }

  function syncConnectedSegments(station) {
    state.world.railSegments.forEach(segment => {
      if (segment.fromStationId === station.id && segment.path.length) segment.path[0] = Core.deepClone(station.position);
      if (segment.toStationId === station.id && segment.path.length) segment.path[segment.path.length - 1] = Core.deepClone(station.position);
    });
  }

  function updateObjectField(object, field, value) {
    const parts = field.split('.');
    if (parts.length === 2) object[parts[0]][parts[1]] = value;
    else object[field] = value;
  }

  function handleInspectorChange(event) {
    const worldField = event.target.dataset.worldField;
    if (worldField) {
      pushHistory();
      state.world[worldField] = event.target.value;
      logAction(`Updated world ${worldField}`);
      afterWorldChange();
      return;
    }

    const object = getSelectedObject();
    if (!object || state.mode !== 'architect') return;
    const lineId = event.target.dataset.lineToggle;
    if (lineId) {
      pushHistory();
      object.lineIds = event.target.checked ? Array.from(new Set([...object.lineIds, lineId])) : object.lineIds.filter(id => id !== lineId);
      logAction(`Updated line assignment for ${object.name || object.id}`);
      afterWorldChange();
      return;
    }

    const field = event.target.dataset.field;
    if (!field) return;
    pushHistory();
    const previousName = object.name;
    let value = event.target.type === 'checkbox' ? event.target.checked : event.target.type === 'number' ? Number(event.target.value) : event.target.value;
    if (field === 'position.x') value = clamp(value, 0, state.world.settings.worldWidth);
    if (field === 'position.y') value = clamp(value, 0, state.world.settings.worldHeight);
    updateObjectField(object, field, value);
    if (state.selected.type === 'station' && field === 'name') object.slug = Core.slugify(value);
    if (state.selected.type === 'station' && field.startsWith('position.')) syncConnectedSegments(object);
    logAction(`Updated ${TYPE_CONFIG[state.selected.type].label.toLowerCase()} ${previousName || object.text || object.id}`);
    afterWorldChange();
  }

  function deleteSelected() {
    if (!state.selected || state.mode !== 'architect') return;
    const object = getSelectedObject();
    if (!object) return;
    const label = object.name || object.text || object.id;
    if (!window.confirm(`Delete ${label}? This action can be undone.`)) return;
    pushHistory();
    const collection = getCollection(state.selected.type);
    const index = collection.findIndex(item => item.id === object.id);
    if (index >= 0) collection.splice(index, 1);
    if (state.selected.type === 'station') {
      state.world.railSegments.forEach(segment => {
        if (segment.fromStationId === object.id) segment.fromStationId = '';
        if (segment.toStationId === object.id) segment.toStationId = '';
      });
    }
    logAction(`Deleted ${label}`);
    state.selected = null;
    afterWorldChange();
  }

  function validateAndShow() {
    state.validation = Core.validateWorld(state.world);
    state.bottomTab = 'validation';
    els.bottomPanel.classList.remove('collapsed');
    renderBottom();
    const errors = state.validation.filter(issue => issue.severity === 'error').length;
    toast(errors ? `Validation found ${errors} error${errors === 1 ? '' : 's'}.` : 'Validation passed with no structural errors.', errors ? 'error' : '');
  }

  function exportWorld() {
    state.world.updatedAt = new Date().toISOString();
    const blob = new Blob([JSON.stringify(state.world, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${Core.slugify(state.world.name)}.borail.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Exported the complete BoRail world.');
  }

  function importWorld(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const issues = Core.validateWorld(parsed);
        const errors = issues.filter(issue => issue.severity === 'error');
        if (errors.length) {
          state.validation = issues;
          state.bottomTab = 'validation';
          renderBottom();
          toast(`Import blocked: ${errors[0].message}`, 'error');
          return;
        }
        if (!window.confirm(`Replace the current draft with “${parsed.name}”?`)) return;
        pushHistory();
        state.world = parsed;
        state.selected = null;
        state.validation = issues;
        logAction(`Imported ${file.name}`);
        fitWorld();
        afterWorldChange();
        toast('BoRail world imported successfully.');
      } catch (error) {
        toast('Import blocked: the selected file is not valid JSON.', 'error');
      } finally {
        els.importFile.value = '';
      }
    };
    reader.readAsText(file);
  }

  function resetDemo() {
    if (!window.confirm('Reset the Workbench to the original Green Line demo? Export your current world first if you want to keep it.')) return;
    pushHistory();
    state.world = Core.createSeedWorld();
    state.selected = null;
    state.validation = Core.validateWorld(state.world);
    fitWorld();
    afterWorldChange();
    toast('Green Line demo restored.');
  }

  function handleMapPointerDown(event) {
    const point = eventPoint(event);
    const objectNode = event.target.closest('[data-object-type]');
    if (event.button === 1 || event.button === 2 || event.shiftKey) {
      event.preventDefault();
      state.pan = { startClient: { x: event.clientX, y: event.clientY }, startViewBox: { ...state.viewBox } };
      els.map.setPointerCapture(event.pointerId);
      return;
    }
    if (state.mode !== 'architect' || state.tool !== 'select' || !objectNode) return;
    const type = objectNode.dataset.objectType;
    const id = objectNode.dataset.objectId;
    if (!['station', 'label'].includes(type)) return;
    const object = getObject(type, id);
    pushHistory();
    state.drag = { type, id, startPoint: point, startPosition: Core.deepClone(object.position), moved: false };
    els.map.setPointerCapture(event.pointerId);
  }

  function handleMapPointerMove(event) {
    const point = eventPoint(event);
    state.pointerWorld = point;
    if (state.pan) {
      const rect = els.map.getBoundingClientRect();
      const dx = (event.clientX - state.pan.startClient.x) * state.pan.startViewBox.width / rect.width;
      const dy = (event.clientY - state.pan.startClient.y) * state.pan.startViewBox.height / rect.height;
      state.viewBox.x = state.pan.startViewBox.x - dx;
      state.viewBox.y = state.pan.startViewBox.y - dy;
      applyViewBox();
      return;
    }
    if (state.drag) {
      const object = getObject(state.drag.type, state.drag.id);
      object.position.x = clamp(state.drag.startPosition.x + point.x - state.drag.startPoint.x, 0, state.world.settings.worldWidth);
      object.position.y = clamp(state.drag.startPosition.y + point.y - state.drag.startPoint.y, 0, state.world.settings.worldHeight);
      if (state.drag.type === 'station') syncConnectedSegments(object);
      state.drag.moved = true;
      renderMap();
      return;
    }
    if (state.drawingPoints.length) renderDrawing();
  }

  function handleMapPointerUp(event) {
    if (state.pan) {
      state.pan = null;
      try { els.map.releasePointerCapture(event.pointerId); } catch (error) {}
      return;
    }
    if (state.drag) {
      const dragged = state.drag;
      state.drag = null;
      try { els.map.releasePointerCapture(event.pointerId); } catch (error) {}
      if (dragged.moved) {
        const object = getObject(dragged.type, dragged.id);
        logAction(`Moved ${object.name || object.text}`);
        afterWorldChange();
      } else {
        state.undoStack.pop();
        updateUndoRedoButtons();
      }
    }
  }

  function handleMapClick(event) {
    if (state.pan || state.drag) return;
    const objectNode = event.target.closest('[data-object-type]');
    if (objectNode && state.tool === 'select') {
      setSelected(objectNode.dataset.objectType, objectNode.dataset.objectId);
      return;
    }
    if (state.mode === 'preview') {
      if (!objectNode) {
        state.selected = null;
        renderInspector();
        renderMap();
      }
      return;
    }
    const point = eventPoint(event);
    if (state.tool === 'station') addStation(point);
    else if (state.tool === 'label') addLabel(point);
    else if (DRAWING_TOOLS.has(state.tool)) {
      state.drawingPoints.push(point);
      renderDrawing();
    } else if (!objectNode) {
      state.selected = null;
      renderMap();
      renderInspector();
    }
  }

  function bindEvents() {
    document.querySelectorAll('.tool').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)));
    document.querySelectorAll('.mode-button').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
    document.querySelectorAll('.bottom-tab').forEach(button => button.addEventListener('click', () => {
      state.bottomTab = button.dataset.bottomTab;
      renderBottom();
    }));
    document.querySelectorAll('.mobile-panel-toggle').forEach(button => button.addEventListener('click', () => {
      const panel = button.dataset.toggle === 'toolbar' ? document.querySelector('.toolbar') : document.querySelector('.inspector');
      panel.classList.toggle('collapsed');
    }));

    els.finishDrawingButton.addEventListener('click', finishDrawing);
    els.cancelDrawingButton.addEventListener('click', cancelDrawing);
    els.undoButton.addEventListener('click', undo);
    els.redoButton.addEventListener('click', redo);
    els.validateButton.addEventListener('click', validateAndShow);
    els.saveButton.addEventListener('click', () => saveDraft(true));
    els.exportButton.addEventListener('click', exportWorld);
    els.importButton.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', () => { if (els.importFile.files[0]) importWorld(els.importFile.files[0]); });
    els.resetButton.addEventListener('click', resetDemo);
    els.zoomInButton.addEventListener('click', () => zoom(0.75));
    els.zoomOutButton.addEventListener('click', () => zoom(1.3));
    els.fitButton.addEventListener('click', fitWorld);
    els.bottomCollapseButton.addEventListener('click', () => {
      els.bottomPanel.classList.toggle('collapsed');
      els.bottomCollapseButton.textContent = els.bottomPanel.classList.contains('collapsed') ? '+' : '−';
    });

    els.inspectorContent.addEventListener('change', handleInspectorChange);
    els.inspectorContent.addEventListener('click', event => {
      if (event.target.id === 'deleteSelectedButton') deleteSelected();
    });
    els.bottomContent.addEventListener('click', event => {
      const issue = event.target.closest('[data-issue-type]');
      if (issue && issue.dataset.issueType && issue.dataset.issueId) {
        setSelected(issue.dataset.issueType, issue.dataset.issueId);
      }
    });

    els.map.addEventListener('pointerdown', handleMapPointerDown);
    els.map.addEventListener('pointermove', handleMapPointerMove);
    els.map.addEventListener('pointerup', handleMapPointerUp);
    els.map.addEventListener('pointercancel', handleMapPointerUp);
    els.map.addEventListener('click', handleMapClick);
    els.map.addEventListener('dblclick', event => {
      if (DRAWING_TOOLS.has(state.tool)) {
        event.preventDefault();
        finishDrawing();
      }
    });
    els.map.addEventListener('contextmenu', event => event.preventDefault());
    els.map.addEventListener('wheel', event => {
      event.preventDefault();
      zoom(event.deltaY > 0 ? 1.16 : 0.86, eventPoint(event));
    }, { passive: false });

    els.stationSearch.addEventListener('input', () => {
      const query = els.stationSearch.value.trim().toLowerCase();
      if (!query) return;
      const station = state.world.stations.find(item => item.name.toLowerCase().includes(query));
      if (station) {
        state.selected = { type: 'station', id: station.id };
        centerOn(station.position);
        renderMap();
        renderInspector();
      }
    });
    els.greenLineFilter.addEventListener('change', () => {
      state.greenVisible = els.greenLineFilter.checked;
      renderMap();
    });

    document.addEventListener('keydown', event => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (typing) return;
      if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected();
      if (event.key === 'Escape') {
        if (state.drawingPoints.length) cancelDrawing();
        else { state.selected = null; setTool('select'); renderAll(); }
      }
      if (event.key === 'Enter' && DRAWING_TOOLS.has(state.tool)) finishDrawing();
    });
  }

  state.validation = Core.validateWorld(state.world);
  bindEvents();
  setTool('select');
  fitWorld();
  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
