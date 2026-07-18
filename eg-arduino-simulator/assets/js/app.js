(function () {
  'use strict';

  const $ = (root, selector) => root.querySelector(selector);
  const $$ = (root, selector) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const deepClone = value => JSON.parse(JSON.stringify(value));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function escapeHtml(value) {
    const span = document.createElement('span');
    span.textContent = String(value ?? '');
    return span.innerHTML;
  }

  function svgTextToElement(text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
      throw new Error('Invalid SVG component artwork');
    }
    svg.querySelectorAll('script,foreignObject,iframe,object,embed').forEach(node => node.remove());
    svg.querySelectorAll('*').forEach(node => {
      Array.from(node.attributes).forEach(attr => {
        if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
        if ((attr.name === 'href' || attr.name.endsWith(':href')) && /^https?:/i.test(attr.value)) {
          node.removeAttribute(attr.name);
        }
      });
    });
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    return document.importNode(svg, true);
  }

  function getSvgViewBox(svg) {
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width && vb.height) return {x: vb.x, y: vb.y, width: vb.width, height: vb.height};
    const width = parseFloat(svg.getAttribute('width')) || 100;
    const height = parseFloat(svg.getAttribute('height')) || 100;
    return {x: 0, y: 0, width, height};
  }

  class AssetLoader {
    constructor(settings) {
      this.settings = settings;
      this.cache = new Map();
    }

    url(repo, path, ref = 'main') {
      const params = new URLSearchParams({
        action: 'egas_asset',
        nonce: this.settings.assetNonce,
        repo,
        ref,
        path
      });
      return `${this.settings.ajaxUrl}?${params.toString()}`;
    }

    async text(repo, path, ref = 'main') {
      const key = `text:${repo}:${ref}:${path}`;
      if (this.cache.has(key)) return this.cache.get(key);
      const promise = fetch(this.url(repo, path, ref), {credentials: 'same-origin'}).then(async response => {
        if (!response.ok) throw new Error(`${response.status} ${path}`);
        return response.text();
      });
      this.cache.set(key, promise);
      try { return await promise; } catch (error) { this.cache.delete(key); throw error; }
    }

    async json(repo, path, ref = 'main') {
      return JSON.parse(await this.text(repo, path, ref));
    }

    async firstText(repo, candidates, ref = 'main') {
      let lastError = null;
      for (const path of candidates) {
        try { return {path, text: await this.text(repo, path, ref)}; } catch (error) { lastError = error; }
      }
      throw lastError || new Error('No component asset found');
    }

    async firstJson(repo, candidates, ref = 'main') {
      const result = await this.firstText(repo, candidates, ref);
      return {path: result.path, value: JSON.parse(result.text)};
    }
  }

  class ArduinoRuntime {
    constructor(app) {
      this.app = app;
      this.stopped = true;
      this.timers = new Set();
      this.pinModes = new Map();
      this.startTime = 0;
    }

    stop() {
      this.stopped = true;
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
    }

    delay(ms) {
      if (this.stopped) return Promise.reject(new Error('Simulation stopped'));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          this.stopped ? reject(new Error('Simulation stopped')) : resolve();
        }, Math.max(0, Number(ms) || 0));
        this.timers.add(timer);
      });
    }

    map(value, inMin, inMax, outMin, outMax) {
      if (Number(inMax) === Number(inMin)) return Number(outMin);
      return (Number(value) - Number(inMin)) * (Number(outMax) - Number(outMin)) / (Number(inMax) - Number(inMin)) + Number(outMin);
    }

    transpile(source) {
      let code = String(source || '').replace(/\r\n?/g, '\n');
      code = code.replace(/^\s*#include[^\n]*$/gm, '');
      code = code.replace(/^\s*#define\s+(\w+)\s+([^\n]+)$/gm, 'const $1 = $2;');
      code = code.replace(/\/\*[\s\S]*?\*\//g, '');
      code = code.replace(/\bSerial\s*\.\s*begin\s*\([^)]*\)\s*;/g, '');
      code = code.replace(/\bSerial\s*\.\s*println\s*\(/g, 'serialPrintln(');
      code = code.replace(/\bSerial\s*\.\s*print\s*\(/g, 'serialPrint(');
      code = code.replace(/\bdelayMicroseconds\s*\(/g, 'await delayMicroseconds(');
      code = code.replace(/\bdelay\s*\(/g, 'await delay(');
      code = code.replace(/\b(int|long|unsigned\s+long|unsigned\s+int|byte|bool|boolean|float|double|String|char)\s+(?=[A-Za-z_])/g, 'let ');
      code = code.replace(/for\s*\(\s*let\s+/g, 'for (let ');
      code = code.replace(/\bvoid\s+(setup|loop)\s*\(/g, 'async function $1(');
      code = code.replace(/\b(void|int|long|float|double|bool|String)\s+([A-Za-z_]\w*)\s*\(/g, 'async function $2(');
      code = code.replace(/\bHIGH\b/g, '1').replace(/\bLOW\b/g, '0');
      code = code.replace(/\bINPUT_PULLUP\b/g, '"INPUT_PULLUP"').replace(/\bINPUT_PULLDOWN\b/g, '"INPUT_PULLDOWN"');
      code = code.replace(/\bINPUT\b/g, '"INPUT"').replace(/\bOUTPUT\b/g, '"OUTPUT"');
      code = code.replace(/\btrue\b/g, 'true').replace(/\bfalse\b/g, 'false');
      code = code.replace(/\bmillis\s*\(\s*\)/g, 'millis()');
      return code;
    }

    async run(source) {
      this.stop();
      this.stopped = false;
      this.startTime = performance.now();
      this.pinModes.clear();

      const api = {
        pinMode: (pin, mode) => this.pinModes.set(String(pin), mode),
        digitalWrite: (pin, value) => this.app.writeBoardPin(pin, Number(value) ? 1 : 0, 'digital'),
        analogWrite: (pin, value) => this.app.writeBoardPin(pin, clamp(Number(value) || 0, 0, 255), 'pwm'),
        digitalRead: pin => this.app.readBoardPin(pin, 'digital'),
        analogRead: pin => this.app.readBoardPin(pin, 'analog'),
        delay: ms => this.delay(ms),
        delayMicroseconds: us => this.delay(Math.max(0, Number(us) || 0) / 1000),
        millis: () => Math.floor(performance.now() - this.startTime),
        map: (...args) => this.map(...args),
        constrain: (value, min, max) => clamp(value, min, max),
        serialPrint: value => this.app.serial(String(value)),
        serialPrintln: value => this.app.serial(`${value ?? ''}\n`),
        tone: (pin, frequency) => this.app.writeBoardPin(pin, Number(frequency) || 0, 'tone'),
        noTone: pin => this.app.writeBoardPin(pin, 0, 'tone'),
        abs: Math.abs, min: Math.min, max: Math.max, round: Math.round,
        floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, pow: Math.pow,
        sin: Math.sin, cos: Math.cos, PI: Math.PI
      };

      const names = Object.keys(api);
      const values = Object.values(api);
      const transpiled = this.transpile(source);
      const wrapped = `"use strict";\n${transpiled}\nreturn { setup: typeof setup === 'function' ? setup : async()=>{}, loop: typeof loop === 'function' ? loop : async()=>{} };`;
      let sketch;
      try {
        sketch = new Function(...names, wrapped)(...values);
      } catch (error) {
        this.stop();
        throw new Error(`Compile error: ${error.message}`);
      }

      await sketch.setup();
      let guard = 0;
      while (!this.stopped) {
        await sketch.loop();
        guard += 1;
        if (guard % 50 === 0) await this.delay(0);
      }
    }
  }

  class EGArduinoSimulator {
    constructor(root, settings) {
      this.root = root;
      this.settings = settings;
      this.loader = new AssetLoader(settings);
      this.catalog = Array.from(window.EGAS_CATALOG || []);
      this.examples = window.EGAS_EXAMPLES || {};
      this.state = {
        components: [], wires: [], selected: null,
        camera: {x: 0, y: 0, scale: 1},
        showGrid: true, zCounter: 10
      };
      this.history = [];
      this.historyIndex = -1;
      this.pinElements = new Map();
      this.componentElements = new Map();
      this.wireElements = new Map();
      this.draftWire = null;
      this.drag = null;
      this.editor = null;
      this.runtime = new ArduinoRuntime(this);
      this.resolveDom();
      this.bind();
      this.initEditor();
      this.renderLibrary();
      this.populateExamples();
      this.resizeWorld();
      this.loadInitialProject();
    }

    resolveDom() {
      this.stage = $(this.root, '[data-role="stage"]');
      this.world = $(this.root, '[data-role="world"]');
      this.componentLayer = $(this.root, '[data-role="component-layer"]');
      this.pinLayer = $(this.root, '[data-role="pin-layer"]');
      this.selectionLayer = $(this.root, '[data-role="selection-layer"]');
      this.wireLayer = $(this.root, '[data-role="wire-layer"]');
      this.wirePaths = $(this.root, '[data-role="wire-paths"]');
      this.wireHandles = $(this.root, '[data-role="wire-handles"]');
      this.draftPath = $(this.root, '[data-role="draft-wire"]');
      this.library = $(this.root, '[data-role="component-library"]');
      this.categoryTabs = $(this.root, '[data-role="category-tabs"]');
      this.searchInput = $(this.root, '[data-role="component-search"]');
      this.libraryCount = $(this.root, '[data-role="library-count"]');
      this.modeStatus = $(this.root, '[data-role="mode-status"]');
      this.zoomLabel = $(this.root, '[data-role="zoom-label"]');
      this.inspector = $(this.root, '[data-role="inspector"]');
      this.emptyInspector = $(this.root, '[data-role="empty-inspector"]');
      this.serialOutput = $(this.root, '[data-role="serial-output"]');
      this.compileStatus = $(this.root, '[data-role="compile-status"]');
      this.exampleSelect = $(this.root, '[data-role="example-select"]');
      this.toastRegion = $(this.root, '[data-role="toasts"]');
    }

    initEditor() {
      const textarea = $(this.root, '[data-role="code-editor"]');
      const initial = this.examples.blink ? this.examples.blink.code : 'void setup() {}\n\nvoid loop() {}';
      textarea.value = initial;
      if (window.CodeMirror) {
        this.editor = window.CodeMirror.fromTextArea(textarea, {
          mode: 'text/x-c++src', theme: 'eclipse', lineNumbers: true,
          matchBrackets: true, autoCloseBrackets: true, indentUnit: 2,
          tabSize: 2, lineWrapping: false
        });
        this.editor.setSize('100%', '100%');
      }
    }

    getCode() { return this.editor ? this.editor.getValue() : $(this.root, '[data-role="code-editor"]').value; }
    setCode(code) { this.editor ? this.editor.setValue(code) : ($(this.root, '[data-role="code-editor"]').value = code); }

    bind() {
      this.root.addEventListener('click', event => {
        const actionNode = event.target.closest('[data-action]');
        if (actionNode && this.root.contains(actionNode)) this.handleAction(actionNode.dataset.action, actionNode, event);
        const tab = event.target.closest('[data-tab]');
        if (tab) this.activateTab(tab.dataset.tab);
      });

      this.searchInput.addEventListener('input', () => this.renderLibrary());
      this.categoryTabs.addEventListener('click', event => {
        const button = event.target.closest('[data-category]');
        if (!button) return;
        this.categoryTabs.dataset.active = button.dataset.category;
        this.renderLibrary();
      });
      this.library.addEventListener('click', event => {
        const card = event.target.closest('[data-catalog-id]');
        if (card) this.addComponent(card.dataset.catalogId);
      });
      this.library.addEventListener('dragstart', event => {
        const card = event.target.closest('[data-catalog-id]');
        if (card) event.dataTransfer.setData('text/egas-component', card.dataset.catalogId);
      });
      this.stage.addEventListener('dragover', event => event.preventDefault());
      this.stage.addEventListener('drop', event => {
        event.preventDefault();
        const id = event.dataTransfer.getData('text/egas-component');
        if (!id) return;
        const point = this.clientToWorld(event.clientX, event.clientY);
        this.addComponent(id, point.x, point.y);
      });

      this.stage.addEventListener('pointerdown', event => this.onStagePointerDown(event));
      window.addEventListener('pointermove', event => this.onPointerMove(event));
      window.addEventListener('pointerup', event => this.onPointerUp(event));
      this.stage.addEventListener('wheel', event => this.onWheel(event), {passive: false});
      this.stage.addEventListener('contextmenu', event => event.preventDefault());
      this.stage.addEventListener('keydown', event => this.onKeyDown(event));
      window.addEventListener('resize', () => { this.resizeWorld(); this.renderAll(); });
    }

    handleAction(action, node, event) {
      const actions = {
        new: () => this.newProject(),
        undo: () => this.undo(), redo: () => this.redo(),
        save: () => this.saveProject(), export: () => this.exportProject(),
        fit: () => this.fitAll(), run: () => this.runSimulation(), stop: () => this.stopSimulation(),
        'zoom-in': () => this.zoomBy(1.15), 'zoom-out': () => this.zoomBy(1 / 1.15),
        'reset-view': () => { this.state.camera = {x: 0, y: 0, scale: 1}; this.applyCamera(); },
        'toggle-grid': () => { this.state.showGrid = !this.state.showGrid; node.classList.toggle('is-active', this.state.showGrid); this.stage.classList.toggle('no-grid', !this.state.showGrid); },
        'load-example': () => this.loadExample(this.exampleSelect.value),
        'clear-serial': () => { this.serialOutput.textContent = ''; },
        'delete-selected': () => this.deleteSelected(),
        duplicate: () => this.duplicateSelected(),
        rotate: () => this.rotateSelected(90),
        'rotate-left': () => this.rotateSelected(-90),
        lock: () => this.toggleLockSelected(),
        front: () => this.changeZSelected('front'),
        back: () => this.changeZSelected('back'),
        'reset-size': () => this.setSelectedScale(1)
      };
      if (actions[action]) actions[action]();
      if (action === 'import' && node.files && node.files[0]) this.importProject(node.files[0]);
    }

    activateTab(name) {
      $$(this.root, '[data-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.tab === name));
      $$(this.root, '[data-panel]').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === name));
      if (name === 'code' && this.editor) setTimeout(() => this.editor.refresh(), 0);
    }

    renderLibrary() {
      const query = this.searchInput.value.trim().toLowerCase();
      const categories = ['All', ...new Set(this.catalog.map(item => item.category))];
      let active = this.categoryTabs.dataset.active || 'All';
      if (!categories.includes(active)) active = 'All';
      this.categoryTabs.dataset.active = active;
      this.categoryTabs.innerHTML = categories.map(category => `<button type="button" data-category="${escapeHtml(category)}" class="${category === active ? 'is-active' : ''}">${escapeHtml(category)}</button>`).join('');
      const filtered = this.catalog.filter(item => {
        const categoryMatch = active === 'All' || item.category === active;
        const haystack = [item.label, item.category, ...(item.keywords || [])].join(' ').toLowerCase();
        return categoryMatch && (!query || haystack.includes(query));
      });
      this.libraryCount.textContent = `${filtered.length}/${this.catalog.length}`;
      this.library.innerHTML = filtered.map(item => `
        <button type="button" draggable="true" class="egas-library-card" data-catalog-id="${escapeHtml(item.id)}">
          <span class="egas-library-preview" data-preview-kind="${escapeHtml(item.kind)}">${this.previewMarkup(item)}</span>
          <span class="egas-library-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.source)}</small></span>
          <span class="egas-library-add" aria-hidden="true">＋</span>
        </button>`).join('');
      this.hydrateLibraryPreviews();
    }

    previewMarkup(item) {
      if (item.kind === 'wokwi') return `<${item.tag} class="egas-preview-part"></${item.tag}>`;
      if (item.renderer === 'ttmotor') return this.ttMotorSvg(true);
      if (item.renderer === 'l298n') return this.l298nSvg(true);
      if (item.kind === 'fritzing') return '<span class="egas-source-badge">Fritzing</span>';
      return '<span class="egas-source-badge">Wokwi<br>Community</span>';
    }

    hydrateLibraryPreviews() {
      this.library.querySelectorAll('.egas-preview-part').forEach(part => {
        part.style.transform = 'scale(.34)';
        part.style.transformOrigin = 'center';
        part.style.pointerEvents = 'none';
      });
    }

    populateExamples() {
      this.exampleSelect.innerHTML = Object.entries(this.examples).map(([id, example]) => `<option value="${escapeHtml(id)}">${escapeHtml(example.label)}</option>`).join('');
    }

    loadInitialProject() {
      const key = `egas-project-${this.settings.instanceId}`;
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(key)); } catch (_) {}
      if (saved && Array.isArray(saved.components)) this.loadProject(saved, false);
      else this.loadExample('blink', false);
      this.commitHistory();
    }

    getCatalog(id) { return this.catalog.find(item => item.id === id); }

    addComponent(catalogId, x = null, y = null, options = {}) {
      const catalog = this.getCatalog(catalogId);
      if (!catalog) { this.toast(`Unknown component: ${catalogId}`, 'error'); return null; }
      const center = this.clientToWorld(this.stage.getBoundingClientRect().left + this.stage.clientWidth / 2, this.stage.getBoundingClientRect().top + this.stage.clientHeight / 2);
      const model = {
        id: options.id || uid('part'), catalogId,
        x: Number.isFinite(x) ? x : center.x - catalog.width / 2,
        y: Number.isFinite(y) ? y : center.y - catalog.height / 2,
        width: catalog.width, height: catalog.height,
        scale: options.scale || 1, rotation: options.rotation || 0,
        locked: !!options.locked, z: options.z || ++this.state.zCounter,
        attrs: {...(catalog.attrs || {}), ...(options.attrs || {})},
        pins: options.pins || [], buses: options.buses || [],
        pinValues: options.pinValues || {}, loadState: 'pending'
      };
      this.state.components.push(model);
      this.createComponentElement(model, catalog);
      this.select({type: 'component', id: model.id});
      if (!options.silent) this.commitHistory();
      return model;
    }

    createComponentElement(model, catalog) {
      const element = document.createElement('div');
      element.className = 'egas-component';
      element.dataset.componentId = model.id;
      element.innerHTML = `
        <div class="egas-component-transform">
          <div class="egas-part-art"></div>
          <div class="egas-component-label">${escapeHtml(catalog.label)}</div>
          <button type="button" class="egas-resize-handle" title="Resize" aria-label="Resize component"></button>
        </div>`;
      this.componentLayer.appendChild(element);
      this.componentElements.set(model.id, element);
      this.updateComponentElement(model);
      this.renderComponentArt(model, catalog).catch(error => {
        model.loadState = 'error';
        $('.egas-part-art', element).innerHTML = `<div class="egas-load-error"><strong>Could not load artwork</strong><small>${escapeHtml(error.message)}</small></div>`;
        this.toast(`${catalog.label}: ${error.message}`, 'error');
      });
    }

    async renderComponentArt(model, catalog) {
      const element = this.componentElements.get(model.id);
      if (!element) return;
      const host = $('.egas-part-art', element);
      host.innerHTML = '<span class="egas-loader"></span>';

      if (catalog.kind === 'wokwi') {
        await customElements.whenDefined(catalog.tag).catch(() => {});
        const part = document.createElement(catalog.tag);
        Object.entries(model.attrs || {}).forEach(([key, value]) => {
          try { part[key] = value; } catch (_) { part.setAttribute(key, value); }
        });
        part.className = 'egas-wokwi-part';
        host.replaceChildren(part);
        this.bindInteractivePart(model, part);
        await nextFrame();
        this.readWokwiPins(model, part);
        model.loadState = 'ready';
      } else if (catalog.kind === 'special') {
        host.innerHTML = catalog.renderer === 'l298n' ? this.l298nSvg(false) : this.ttMotorSvg(false);
        model.pins = catalog.pins.map(([name, x, y]) => ({name, x, y}));
        model.loadState = 'ready';
      } else if (catalog.kind === 'custom') {
        await this.loadCustomChip(model, catalog, host);
      } else if (catalog.kind === 'fritzing') {
        await this.loadFritzingPart(model, catalog, host);
      }

      this.renderPins();
      this.renderWires();
      this.updateInspector();
    }

    bindInteractivePart(model, part) {
      const setDigital = value => {
        model.interactiveValue = value ? 1 : 0;
        const names = (model.pins || []).map(pin => pin.name);
        names.forEach(name => model.pinValues[name] = model.interactiveValue);
      };
      part.addEventListener('button-press', () => setDigital(0));
      part.addEventListener('button-release', () => setDigital(1));
      part.addEventListener('input', event => {
        const detail = event.detail || {};
        const value = Number(detail.value ?? detail.x ?? part.value ?? 0);
        model.interactiveValue = Number.isFinite(value) ? value : 0;
        (model.pins || []).forEach(pin => model.pinValues[pin.name] = model.interactiveValue);
      });
      part.addEventListener('rotate', event => {
        model.interactiveValue = Number(event.detail && event.detail.value || 0);
      });
    }

    readWokwiPins(model, part) {
      const info = Array.isArray(part.pinInfo) ? part.pinInfo : [];
      if (!info.length) {
        model.pins = this.genericPinsForElement(part.tagName.toLowerCase(), model.width, model.height);
        return;
      }
      model.pins = info.map((pin, index) => ({
        name: String(pin.name ?? pin.label ?? pin.id ?? index),
        x: Number(pin.x ?? pin.cx ?? 0), y: Number(pin.y ?? pin.cy ?? 0)
      })).filter(pin => Number.isFinite(pin.x) && Number.isFinite(pin.y));
    }

    genericPinsForElement(tag, width, height) {
      const known = {
        'wokwi-led': ['A', 'C'], 'wokwi-buzzer': ['1', '2'], 'wokwi-servo': ['PWM', 'V+', 'GND'],
        'wokwi-relay-module': ['VCC', 'GND', 'IN', 'NO', 'COM', 'NC'],
        'wokwi-dht22': ['VCC', 'SDA', 'NC', 'GND'], 'wokwi-hc-sr04': ['VCC', 'TRIG', 'ECHO', 'GND']
      };
      const pins = known[tag] || ['1', '2'];
      return this.layoutPins(pins, width, height);
    }

    layoutPins(pinNames, width, height) {
      const names = pinNames.map(pin => typeof pin === 'string' ? pin : pin.name || pin.id || 'PIN');
      const leftCount = Math.ceil(names.length / 2);
      return names.map((name, index) => {
        const left = index < leftCount;
        const row = left ? index : index - leftCount;
        const count = left ? leftCount : names.length - leftCount;
        return {name: String(name), x: left ? 2 : width - 2, y: ((row + 1) / (count + 1)) * height};
      });
    }

    async loadCustomChip(model, catalog, host) {
      let manifest = null;
      let manifestPath = null;
      try {
        const loaded = await this.loader.firstJson(catalog.repo, catalog.manifestCandidates, catalog.ref);
        manifest = loaded.value; manifestPath = loaded.path;
      } catch (_) {
        manifest = {name: catalog.label, author: catalog.repo, pins: catalog.fallbackPins || []};
      }

      let svg = null;
      try {
        const loadedSvg = await this.loader.firstText(catalog.repo, catalog.svgCandidates, catalog.ref);
        svg = svgTextToElement(loadedSvg.text);
      } catch (_) {}

      if (svg) {
        host.replaceChildren(svg);
        await nextFrame();
      } else {
        const pins = Array.isArray(manifest.pins) ? manifest.pins : [];
        host.innerHTML = this.customChipBody(manifest.name || catalog.label, manifest.author || catalog.repo, pins.length);
      }
      const pinNames = Array.isArray(manifest.pins) ? manifest.pins.map(pin => typeof pin === 'string' ? pin : pin.name || pin.id) : catalog.fallbackPins;
      model.pins = this.layoutPins(pinNames.filter(Boolean), model.width, model.height);
      model.customManifest = manifest;
      model.manifestPath = manifestPath;
      model.communityBehavior = catalog.behavior;
      model.loadState = 'ready';
    }

    customChipBody(name, author, pinCount) {
      return `<svg class="egas-custom-chip-svg" viewBox="0 0 180 120" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="pcb" x1="0" x2="1"><stop stop-color="#075f3f"/><stop offset="1" stop-color="#0b8b59"/></linearGradient></defs>
        <rect x="13" y="4" width="154" height="112" rx="9" fill="url(#pcb)" stroke="#06412e" stroke-width="3"/>
        <rect x="31" y="22" width="118" height="76" rx="5" fill="#1c2430" stroke="#9aa5b1"/>
        <text x="90" y="54" fill="#fff" font-size="12" font-family="Arial" text-anchor="middle" font-weight="700">${escapeHtml(name)}</text>
        <text x="90" y="72" fill="#b7c2cc" font-size="7" font-family="Arial" text-anchor="middle">Wokwi community chip</text>
        <text x="90" y="86" fill="#8fe3ba" font-size="6" font-family="Arial" text-anchor="middle">${escapeHtml(author)} · ${pinCount} pins</text>
      </svg>`;
    }

    async loadFritzingPart(model, catalog, host) {
      const fzpText = await this.loader.text(catalog.repo, catalog.path, catalog.ref);
      const doc = new DOMParser().parseFromString(fzpText, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('Invalid Fritzing metadata');
      const layers = doc.querySelector('breadboardView layers');
      if (!layers) throw new Error('No Fritzing breadboard view');
      const image = layers.getAttribute('image');
      if (!image) throw new Error('Missing Fritzing breadboard artwork');
      const svgPath = image.startsWith('svg/') ? image : `svg/core/${image}`;
      const svgText = await this.loader.text(catalog.repo, svgPath, catalog.ref);
      const svg = svgTextToElement(svgText);
      host.replaceChildren(svg);
      await nextFrame();
      const vb = getSvgViewBox(svg);
      const pins = [];
      doc.querySelectorAll('connectors > connector').forEach(connector => {
        const name = connector.getAttribute('name') || connector.getAttribute('id');
        const p = connector.querySelector('breadboardView p');
        if (!p) return;
        const svgId = p.getAttribute('terminalId') || p.getAttribute('svgId');
        if (!svgId) return;
        const target = svg.querySelector(`#${CSS.escape(svgId)}`);
        if (!target || typeof target.getBBox !== 'function') return;
        try {
          const box = target.getBBox();
          pins.push({
            name, connectorId: connector.getAttribute('id'),
            x: ((box.x + box.width / 2 - vb.x) / vb.width) * model.width,
            y: ((box.y + box.height / 2 - vb.y) / vb.height) * model.height
          });
        } catch (_) {}
      });
      model.pins = pins;
      model.buses = [];
      doc.querySelectorAll('buses > bus').forEach(bus => {
        const members = Array.from(bus.querySelectorAll('nodeMember')).map(node => node.getAttribute('connectorId')).filter(Boolean);
        if (members.length > 1) model.buses.push(members);
      });
      model.loadState = 'ready';
    }

    l298nSvg(preview) {
      return `<svg class="egas-special-svg" viewBox="0 0 255 205" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="l298pcb" x1="0" x2="1"><stop stop-color="#9b1519"/><stop offset=".5" stop-color="#dc252c"/><stop offset="1" stop-color="#a50f15"/></linearGradient>
          <linearGradient id="sink" x1="0" x2="1"><stop stop-color="#222"/><stop offset=".5" stop-color="#777"/><stop offset="1" stop-color="#1c1c1c"/></linearGradient>
          <filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".34"/></filter>
        </defs>
        <g filter="url(#shadow)">
          <rect x="9" y="9" width="237" height="187" rx="9" fill="url(#l298pcb)" stroke="#7d0f13" stroke-width="3"/>
          <circle cx="25" cy="25" r="7" fill="#6c0e11" stroke="#eee" stroke-width="2"/><circle cx="230" cy="25" r="7" fill="#6c0e11" stroke="#eee" stroke-width="2"/>
          <circle cx="25" cy="180" r="7" fill="#6c0e11" stroke="#eee" stroke-width="2"/><circle cx="230" cy="180" r="7" fill="#6c0e11" stroke="#eee" stroke-width="2"/>
          <g fill="#1966aa" stroke="#073e72" stroke-width="2">
            <rect x="0" y="24" width="33" height="66" rx="4"/><rect x="222" y="24" width="33" height="66" rx="4"/>
            <rect x="73" y="178" width="109" height="27" rx="4"/>
          </g>
          <g fill="#c8d7e5" stroke="#74899b">
            <circle cx="13" cy="38" r="5"/><circle cx="13" cy="57" r="5"/><circle cx="13" cy="76" r="5"/>
            <circle cx="242" cy="38" r="5"/><circle cx="242" cy="57" r="5"/><circle cx="242" cy="76" r="5"/>
            <circle cx="91" cy="191" r="5"/><circle cx="127" cy="191" r="5"/><circle cx="164" cy="191" r="5"/>
          </g>
          <g fill="url(#sink)" stroke="#111">
            <rect x="84" y="25" width="87" height="91" rx="3"/>
            ${Array.from({length: 8}, (_, i) => `<rect x="${89 + i * 10}" y="18" width="5" height="105" rx="1"/>`).join('')}
          </g>
          <rect x="101" y="63" width="53" height="38" rx="3" fill="#141414" stroke="#aaa"/>
          <text x="127.5" y="87" fill="#eee" font-size="14" text-anchor="middle" font-family="Arial" font-weight="700">L298N</text>
          <g fill="#191919" stroke="#aaa">
            <rect x="36" y="108" width="20" height="67" rx="3"/><rect x="199" y="108" width="20" height="67" rx="3"/>
          </g>
          <g fill="#e6c151">${['ENA','IN1','IN2','IN3','IN4','ENB'].map((t,i)=>`<rect x="${32 + i*32}" y="133" width="20" height="20" rx="2"/>`).join('')}</g>
          <g font-family="Arial" font-size="7" fill="#fff" text-anchor="middle">${['ENA','IN1','IN2','IN3','IN4','ENB'].map((t,i)=>`<text x="${42+i*32}" y="163">${t}</text>`).join('')}</g>
          <text x="127" y="16" fill="#fff" font-size="8" font-family="Arial" text-anchor="middle">DUAL H-BRIDGE MOTOR DRIVER</text>
        </g>
      </svg>`;
    }

    ttMotorSvg(preview) {
      return `<svg class="egas-special-svg egas-tt-svg" viewBox="0 0 250 138" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="metal" x1="0" x2="1"><stop stop-color="#7b8187"/><stop offset=".18" stop-color="#e9edf0"/><stop offset=".5" stop-color="#aeb5ba"/><stop offset=".82" stop-color="#f4f6f7"/><stop offset="1" stop-color="#737a80"/></linearGradient>
          <linearGradient id="yellow" x1="0" x2="1"><stop stop-color="#e1a900"/><stop offset=".42" stop-color="#ffd128"/><stop offset="1" stop-color="#e8a900"/></linearGradient>
          <filter id="ttshadow"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity=".32"/></filter>
        </defs>
        <g filter="url(#ttshadow)">
          <path d="M17 28 Q17 14 32 14 H135 Q151 14 151 30 V109 Q151 124 136 124 H31 Q17 124 17 110Z" fill="url(#yellow)" stroke="#b77c00" stroke-width="3"/>
          <path d="M21 47 H147 M21 92 H147" stroke="#d99c00" stroke-width="3" opacity=".75"/>
          <path d="M45 18 V120 M93 18 V120 M128 18 V120" stroke="#f5c936" stroke-width="3" opacity=".85"/>
          <circle cx="54" cy="69" r="26" fill="#f6be12" stroke="#ae7300" stroke-width="4"/><circle cx="54" cy="69" r="12" fill="#d08a00" stroke="#fff0a3" stroke-width="3"/>
          <circle cx="123" cy="69" r="21" fill="#f6be12" stroke="#ae7300" stroke-width="4"/><circle cx="123" cy="69" r="8" fill="#bd7c00"/>
          <circle cx="34" cy="31" r="4" fill="#765000"/><circle cx="34" cy="107" r="4" fill="#765000"/>
          <rect x="146" y="30" width="76" height="78" rx="24" fill="url(#metal)" stroke="#62686c" stroke-width="3"/>
          <path d="M159 34 V104 M173 32 V106 M188 32 V106 M203 36 V102" stroke="#7e858a" opacity=".65"/>
          <rect x="215" y="45" width="17" height="48" rx="5" fill="#303438" stroke="#111"/>
          <rect x="229" y="63" width="20" height="12" rx="3" fill="#b9bdc0" stroke="#666"/>
          <rect x="7" y="58" width="17" height="22" rx="3" fill="#c79200" stroke="#8d6100"/>
          <path d="M54 47 L54 91 M32 69 H76" stroke="#eaa800" stroke-width="3"/>
          <g class="egas-motor-rotor"><circle cx="0" cy="0" r="13" fill="none" stroke="#666" stroke-width="3"/><path d="M-12 0 H12 M0 -12 V12" stroke="#555" stroke-width="3"/></g>
          <g fill="#d4ad5a" stroke="#6f5220"><rect x="23" y="111" width="20" height="7" rx="2"/><rect x="57" y="111" width="20" height="7" rx="2"/></g>
          <text x="85" y="77" fill="#8a5b00" font-size="12" font-family="Arial" font-weight="700" text-anchor="middle">TT MOTOR</text>
        </g>
      </svg>`;
    }

    updateComponentElement(model) {
      const element = this.componentElements.get(model.id);
      if (!element) return;
      element.style.left = `${model.x}px`; element.style.top = `${model.y}px`;
      element.style.width = `${model.width}px`; element.style.height = `${model.height}px`;
      element.style.zIndex = String(model.z);
      element.classList.toggle('is-selected', this.state.selected?.type === 'component' && this.state.selected.id === model.id);
      element.classList.toggle('is-locked', model.locked);
      const transform = $('.egas-component-transform', element);
      transform.style.transform = `rotate(${model.rotation}deg) scale(${model.scale})`;
    }

    renderComponents() { this.state.components.forEach(model => this.updateComponentElement(model)); }

    localToWorld(model, localX, localY) {
      const cx = model.width / 2, cy = model.height / 2;
      const dx = (localX - cx) * model.scale, dy = (localY - cy) * model.scale;
      const angle = model.rotation * Math.PI / 180;
      return {
        x: model.x + cx + dx * Math.cos(angle) - dy * Math.sin(angle),
        y: model.y + cy + dx * Math.sin(angle) + dy * Math.cos(angle)
      };
    }

    pinWorld(componentId, pinName) {
      const model = this.state.components.find(component => component.id === componentId);
      if (!model) return null;
      const pin = model.pins.find(item => item.name === pinName);
      return pin ? this.localToWorld(model, pin.x, pin.y) : null;
    }

    renderPins() {
      this.pinLayer.innerHTML = '';
      this.pinElements.clear();
      this.state.components.forEach(model => {
        model.pins.forEach(pin => {
          const point = this.localToWorld(model, pin.x, pin.y);
          const element = document.createElement('button');
          element.type = 'button'; element.className = 'egas-pin';
          element.dataset.componentId = model.id; element.dataset.pinName = pin.name;
          element.style.left = `${point.x}px`; element.style.top = `${point.y}px`;
          element.title = `${this.getCatalog(model.catalogId)?.label || model.catalogId}: ${pin.name}`;
          element.innerHTML = `<span>${escapeHtml(pin.name)}</span>`;
          if (this.draftWire && this.draftWire.from.componentId === model.id && this.draftWire.from.pin === pin.name) element.classList.add('is-source');
          element.addEventListener('pointerdown', event => { event.stopPropagation(); this.onPinPointerDown(event, model, pin); });
          this.pinLayer.appendChild(element);
          this.pinElements.set(`${model.id}:${pin.name}`, element);
        });
      });
    }

    onPinPointerDown(event, model, pin) {
      event.preventDefault();
      if (!this.draftWire) {
        this.draftWire = {from: {componentId: model.id, pin: pin.name}, points: [], cursor: this.pinWorld(model.id, pin.name)};
        this.modeStatus.textContent = `Wiring from ${pin.name}: click the canvas to add elbows, or click another pin to finish`;
      } else if (this.draftWire.from.componentId === model.id && this.draftWire.from.pin === pin.name) {
        this.cancelDraftWire(); return;
      } else {
        this.state.wires.push({
          id: uid('wire'), from: deepClone(this.draftWire.from), to: {componentId: model.id, pin: pin.name},
          points: deepClone(this.draftWire.points), color: '#16a34a', width: 4
        });
        this.draftWire = null;
        this.modeStatus.textContent = 'Wire created';
        this.commitHistory();
      }
      this.renderPins(); this.renderWires();
    }

    cancelDraftWire() {
      this.draftWire = null; this.draftPath.setAttribute('d', '');
      this.modeStatus.textContent = 'Wire cancelled'; this.renderPins();
    }

    renderWires() {
      this.wirePaths.innerHTML = ''; this.wireHandles.innerHTML = ''; this.wireElements.clear();
      this.state.wires.forEach(wire => {
        const start = this.pinWorld(wire.from.componentId, wire.from.pin);
        const end = this.pinWorld(wire.to.componentId, wire.to.pin);
        if (!start || !end) return;
        const points = wire.points.length ? wire.points : this.autoRoute(start, end);
        const d = this.pathData([start, ...points, end]);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.dataset.wireId = wire.id;
        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.setAttribute('d', d); hit.setAttribute('class', 'egas-wire-hit');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d); path.setAttribute('class', 'egas-wire');
        path.setAttribute('stroke', wire.color || '#16a34a'); path.setAttribute('stroke-width', String(wire.width || 4));
        if (this.state.selected?.type === 'wire' && this.state.selected.id === wire.id) path.classList.add('is-selected');
        hit.addEventListener('pointerdown', event => this.onWirePointerDown(event, wire));
        group.append(hit, path); this.wirePaths.appendChild(group); this.wireElements.set(wire.id, group);
        if (this.state.selected?.type === 'wire' && this.state.selected.id === wire.id) this.renderWireHandles(wire, [start, ...points, end]);
      });
      this.renderDraftWire();
    }

    autoRoute(start, end) {
      const midX = Math.round((start.x + end.x) / 2 / 10) * 10;
      return [{x: midX, y: start.y}, {x: midX, y: end.y}];
    }

    pathData(points) { return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' '); }

    renderWireHandles(wire, renderedPoints) {
      wire.points.forEach((point, index) => {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handle.setAttribute('cx', point.x); handle.setAttribute('cy', point.y); handle.setAttribute('r', '7');
        handle.setAttribute('class', 'egas-wire-elbow'); handle.dataset.wireId = wire.id; handle.dataset.pointIndex = index;
        handle.addEventListener('pointerdown', event => {
          event.stopPropagation(); event.preventDefault();
          this.drag = {type: 'wire-point', wireId: wire.id, index, start: this.clientToWorld(event.clientX, event.clientY), original: {...point}};
        });
        handle.addEventListener('dblclick', event => { event.stopPropagation(); wire.points.splice(index, 1); this.commitHistory(); });
        this.wireHandles.appendChild(handle);
      });
      for (let i = 0; i < renderedPoints.length - 1; i++) {
        const a = renderedPoints[i], b = renderedPoints[i + 1];
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        handle.setAttribute('x', (a.x + b.x) / 2 - 5); handle.setAttribute('y', (a.y + b.y) / 2 - 5);
        handle.setAttribute('width', '10'); handle.setAttribute('height', '10'); handle.setAttribute('rx', '2');
        handle.setAttribute('class', 'egas-wire-segment-handle');
        handle.addEventListener('pointerdown', event => {
          event.stopPropagation(); event.preventDefault();
          if (!wire.points.length) wire.points = this.autoRoute(renderedPoints[0], renderedPoints[renderedPoints.length - 1]);
          this.drag = {type: 'wire-segment', wireId: wire.id, segment: i, start: this.clientToWorld(event.clientX, event.clientY), snapshot: deepClone(wire.points)};
        });
        this.wireHandles.appendChild(handle);
      }
    }

    renderDraftWire() {
      if (!this.draftWire) { this.draftPath.setAttribute('d', ''); return; }
      const start = this.pinWorld(this.draftWire.from.componentId, this.draftWire.from.pin);
      const cursor = this.draftWire.cursor || start;
      if (!start || !cursor) return;
      this.draftPath.setAttribute('d', this.pathData([start, ...this.draftWire.points, cursor]));
    }

    onWirePointerDown(event, wire) {
      event.preventDefault(); event.stopPropagation(); this.select({type: 'wire', id: wire.id});
      if (event.detail === 2) {
        const point = this.clientToWorld(event.clientX, event.clientY);
        wire.points.push({x: Math.round(point.x / 10) * 10, y: Math.round(point.y / 10) * 10});
        this.commitHistory();
      }
    }

    onStagePointerDown(event) {
      this.stage.focus();
      const componentElement = event.target.closest('.egas-component');
      const resize = event.target.closest('.egas-resize-handle');
      if (resize && componentElement) {
        const model = this.getComponent(componentElement.dataset.componentId);
        if (!model || model.locked) return;
        event.preventDefault(); event.stopPropagation();
        this.drag = {type: 'resize', id: model.id, start: this.clientToWorld(event.clientX, event.clientY), scale: model.scale};
        return;
      }
      if (componentElement) {
        const model = this.getComponent(componentElement.dataset.componentId);
        this.select({type: 'component', id: model.id});
        if (!model.locked && event.button === 0) {
          const point = this.clientToWorld(event.clientX, event.clientY);
          this.drag = {type: 'component', id: model.id, start: point, x: model.x, y: model.y};
        }
        return;
      }
      if (event.button === 2 || event.button === 1 || event.shiftKey) {
        this.drag = {type: 'pan', startX: event.clientX, startY: event.clientY, x: this.state.camera.x, y: this.state.camera.y};
        return;
      }
      const point = this.clientToWorld(event.clientX, event.clientY);
      if (this.draftWire) {
        this.draftWire.points.push({x: event.altKey ? point.x : Math.round(point.x / 10) * 10, y: event.altKey ? point.y : Math.round(point.y / 10) * 10});
        this.draftWire.cursor = point; this.renderWires(); return;
      }
      this.select(null);
    }

    onPointerMove(event) {
      if (this.draftWire) { this.draftWire.cursor = this.clientToWorld(event.clientX, event.clientY); this.renderDraftWire(); }
      if (!this.drag) return;
      if (this.drag.type === 'pan') {
        this.state.camera.x = this.drag.x + event.clientX - this.drag.startX;
        this.state.camera.y = this.drag.y + event.clientY - this.drag.startY;
        this.applyCamera(); return;
      }
      const point = this.clientToWorld(event.clientX, event.clientY);
      if (this.drag.type === 'component') {
        const model = this.getComponent(this.drag.id); if (!model) return;
        model.x = this.drag.x + point.x - this.drag.start.x;
        model.y = this.drag.y + point.y - this.drag.start.y;
        if (!event.altKey) { model.x = Math.round(model.x / 10) * 10; model.y = Math.round(model.y / 10) * 10; }
        this.updateComponentElement(model); this.renderPins(); this.renderWires();
      } else if (this.drag.type === 'resize') {
        const model = this.getComponent(this.drag.id); if (!model) return;
        const dx = point.x - this.drag.start.x, dy = point.y - this.drag.start.y;
        model.scale = clamp(this.drag.scale + (dx + dy) / 260, .25, 3);
        this.updateComponentElement(model); this.renderPins(); this.renderWires(); this.updateInspector();
      } else if (this.drag.type === 'wire-point') {
        const wire = this.getWire(this.drag.wireId); if (!wire) return;
        wire.points[this.drag.index] = {x: event.altKey ? point.x : Math.round(point.x / 10) * 10, y: event.altKey ? point.y : Math.round(point.y / 10) * 10};
        this.renderWires();
      } else if (this.drag.type === 'wire-segment') {
        const wire = this.getWire(this.drag.wireId); if (!wire) return;
        const delta = {x: point.x - this.drag.start.x, y: point.y - this.drag.start.y};
        wire.points = deepClone(this.drag.snapshot);
        const index = clamp(this.drag.segment, 0, wire.points.length - 1);
        if (wire.points[index]) {
          const horizontal = Math.abs(delta.x) < Math.abs(delta.y);
          wire.points[index][horizontal ? 'y' : 'x'] += horizontal ? delta.y : delta.x;
          if (wire.points[index + 1]) wire.points[index + 1][horizontal ? 'y' : 'x'] += horizontal ? delta.y : delta.x;
        }
        this.renderWires();
      }
    }

    onPointerUp() {
      if (!this.drag) return;
      const changed = ['component', 'resize', 'wire-point', 'wire-segment'].includes(this.drag.type);
      this.drag = null; if (changed) this.commitHistory();
    }

    onWheel(event) {
      event.preventDefault();
      const before = this.clientToWorld(event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      this.state.camera.scale = clamp(this.state.camera.scale * factor, .2, 3);
      const rect = this.stage.getBoundingClientRect();
      this.state.camera.x = event.clientX - rect.left - before.x * this.state.camera.scale;
      this.state.camera.y = event.clientY - rect.top - before.y * this.state.camera.scale;
      this.applyCamera();
    }

    onKeyDown(event) {
      if (event.key === 'Escape') { this.cancelDraftWire(); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); this.deleteSelected(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); this.duplicateSelected(); return; }
      if (this.state.selected?.type !== 'component') return;
      const model = this.getComponent(this.state.selected.id); if (!model || model.locked) return;
      const step = event.shiftKey ? 1 : 10;
      const deltas = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]};
      if (deltas[event.key]) {
        event.preventDefault(); model.x += deltas[event.key][0]; model.y += deltas[event.key][1];
        this.renderAll(); this.commitHistory();
      }
    }

    clientToWorld(clientX, clientY) {
      const rect = this.stage.getBoundingClientRect();
      return {x: (clientX - rect.left - this.state.camera.x) / this.state.camera.scale, y: (clientY - rect.top - this.state.camera.y) / this.state.camera.scale};
    }

    applyCamera() {
      const camera = this.state.camera;
      this.world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
      this.zoomLabel.textContent = `${Math.round(camera.scale * 100)}%`;
    }

    resizeWorld() {
      const width = Math.max(5000, this.stage?.clientWidth ? this.stage.clientWidth * 4 : 5000);
      const height = Math.max(3500, this.stage?.clientHeight ? this.stage.clientHeight * 4 : 3500);
      this.world.style.width = `${width}px`; this.world.style.height = `${height}px`;
      this.wireLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
      this.wireLayer.setAttribute('width', width); this.wireLayer.setAttribute('height', height);
    }

    zoomBy(factor) { this.state.camera.scale = clamp(this.state.camera.scale * factor, .2, 3); this.applyCamera(); }

    fitAll() {
      if (!this.state.components.length) return;
      const bounds = this.state.components.reduce((box, model) => {
        const w = model.width * model.scale, h = model.height * model.scale;
        box.minX = Math.min(box.minX, model.x - (w - model.width) / 2);
        box.minY = Math.min(box.minY, model.y - (h - model.height) / 2);
        box.maxX = Math.max(box.maxX, model.x + model.width + (w - model.width) / 2);
        box.maxY = Math.max(box.maxY, model.y + model.height + (h - model.height) / 2);
        return box;
      }, {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity});
      const pad = 80, availableW = this.stage.clientWidth - pad * 2, availableH = this.stage.clientHeight - pad * 2;
      const scale = clamp(Math.min(availableW / Math.max(1, bounds.maxX - bounds.minX), availableH / Math.max(1, bounds.maxY - bounds.minY)), .2, 1.5);
      this.state.camera.scale = scale;
      this.state.camera.x = pad - bounds.minX * scale + (availableW - (bounds.maxX - bounds.minX) * scale) / 2;
      this.state.camera.y = pad - bounds.minY * scale + (availableH - (bounds.maxY - bounds.minY) * scale) / 2;
      this.applyCamera();
    }

    select(selection) { this.state.selected = selection; this.renderComponents(); this.renderWires(); this.updateInspector(); }
    getComponent(id) { return this.state.components.find(component => component.id === id); }
    getWire(id) { return this.state.wires.find(wire => wire.id === id); }

    updateInspector() {
      const selection = this.state.selected;
      this.emptyInspector.hidden = !!selection;
      this.inspector.hidden = !selection;
      if (!selection) { this.inspector.innerHTML = ''; return; }
      if (selection.type === 'component') {
        const model = this.getComponent(selection.id); if (!model) return;
        const catalog = this.getCatalog(model.catalogId);
        const controls = Array.isArray(model.customManifest?.controls) ? model.customManifest.controls : [];
        this.inspector.innerHTML = `
          <div class="egas-inspector-title"><strong>${escapeHtml(catalog?.label || model.catalogId)}</strong><span>${escapeHtml(catalog?.kind || '')}</span></div>
          <label>Name<input data-inspect="label" value="${escapeHtml(model.label || catalog?.label || '')}"></label>
          <div class="egas-inspector-grid"><label>X<input type="number" data-inspect="x" value="${Math.round(model.x)}"></label><label>Y<input type="number" data-inspect="y" value="${Math.round(model.y)}"></label></div>
          <label>Size <output>${Math.round(model.scale * 100)}%</output><input type="range" min="25" max="300" step="1" data-inspect="scale" value="${Math.round(model.scale * 100)}"></label>
          <div class="egas-inspector-buttons"><button data-action="rotate-left">↶ Rotate</button><button data-action="rotate">Rotate ↷</button><button data-action="reset-size">100%</button></div>
          <div class="egas-inspector-buttons"><button data-action="duplicate">Duplicate</button><button data-action="lock">${model.locked ? 'Unlock' : 'Lock'}</button></div>
          <div class="egas-inspector-buttons"><button data-action="front">Bring front</button><button data-action="back">Send back</button></div>
          ${controls.map(control => this.controlMarkup(model, control)).join('')}
          <details><summary>Component source</summary><p>${escapeHtml(catalog?.source || '')}</p><p>${escapeHtml(catalog?.license || '')}</p>${model.manifestPath ? `<code>${escapeHtml(model.manifestPath)}</code>` : ''}</details>
          <button class="egas-danger" data-action="delete-selected">Delete component</button>`;
        this.bindInspectorFields(model);
      } else {
        const wire = this.getWire(selection.id); if (!wire) return;
        this.inspector.innerHTML = `
          <div class="egas-inspector-title"><strong>Wire</strong><span>${wire.points.length} elbows</span></div>
          <label>Color<input type="color" data-wire-inspect="color" value="${escapeHtml(wire.color || '#16a34a')}"></label>
          <label>Width<input type="range" min="2" max="10" data-wire-inspect="width" value="${wire.width || 4}"></label>
          <p>Drag round handles to move elbows. Drag square handles to move wire segments. Double-click a round handle to remove it.</p>
          <button class="egas-danger" data-action="delete-selected">Delete wire</button>`;
        this.inspector.querySelectorAll('[data-wire-inspect]').forEach(input => input.addEventListener('input', () => {
          wire[input.dataset.wireInspect] = input.dataset.wireInspect === 'width' ? Number(input.value) : input.value; this.renderWires();
        }));
        this.inspector.querySelectorAll('[data-wire-inspect]').forEach(input => input.addEventListener('change', () => this.commitHistory()));
      }
    }

    controlMarkup(model, control) {
      const id = control.id || control.name; if (!id) return '';
      const value = model.attrs[id] ?? control.default ?? control.min ?? 0;
      if (control.type === 'range') return `<label>${escapeHtml(control.label || id)} <output>${escapeHtml(value)}</output><input type="range" data-attr="${escapeHtml(id)}" min="${Number(control.min ?? 0)}" max="${Number(control.max ?? 100)}" step="${Number(control.step ?? 1)}" value="${Number(value)}"></label>`;
      return `<label>${escapeHtml(control.label || id)}<input data-attr="${escapeHtml(id)}" value="${escapeHtml(value)}"></label>`;
    }

    bindInspectorFields(model) {
      this.inspector.querySelectorAll('[data-inspect]').forEach(input => input.addEventListener('input', () => {
        const field = input.dataset.inspect;
        if (field === 'x' || field === 'y') model[field] = Number(input.value) || 0;
        else if (field === 'scale') model.scale = clamp(Number(input.value) / 100, .25, 3);
        else model[field] = input.value;
        this.renderAll();
        const output = input.parentElement.querySelector('output'); if (output && field === 'scale') output.textContent = `${Math.round(model.scale * 100)}%`;
      }));
      this.inspector.querySelectorAll('[data-inspect]').forEach(input => input.addEventListener('change', () => this.commitHistory()));
      this.inspector.querySelectorAll('[data-attr]').forEach(input => input.addEventListener('input', () => {
        model.attrs[input.dataset.attr] = Number.isNaN(Number(input.value)) ? input.value : Number(input.value);
        const output = input.parentElement.querySelector('output'); if (output) output.textContent = input.value;
        const element = this.componentElements.get(model.id)?.querySelector('.egas-wokwi-part');
        if (element) { try { element[input.dataset.attr] = model.attrs[input.dataset.attr]; } catch (_) {} }
      }));
      this.inspector.querySelectorAll('[data-attr]').forEach(input => input.addEventListener('change', () => this.commitHistory()));
    }

    rotateSelected(amount) { const model = this.selectedComponent(); if (!model || model.locked) return; model.rotation = (model.rotation + amount + 360) % 360; this.renderAll(); this.commitHistory(); }
    setSelectedScale(scale) { const model = this.selectedComponent(); if (!model || model.locked) return; model.scale = scale; this.renderAll(); this.commitHistory(); }
    toggleLockSelected() { const model = this.selectedComponent(); if (!model) return; model.locked = !model.locked; this.renderAll(); this.commitHistory(); }
    changeZSelected(direction) { const model = this.selectedComponent(); if (!model) return; model.z = direction === 'front' ? ++this.state.zCounter : 1; this.renderAll(); this.commitHistory(); }
    selectedComponent() { return this.state.selected?.type === 'component' ? this.getComponent(this.state.selected.id) : null; }

    duplicateSelected() {
      const model = this.selectedComponent(); if (!model) return;
      this.addComponent(model.catalogId, model.x + 30, model.y + 30, {...deepClone(model), id: undefined, silent: false, locked: false});
    }

    deleteSelected() {
      const selected = this.state.selected; if (!selected) return;
      if (selected.type === 'component') {
        this.state.components = this.state.components.filter(component => component.id !== selected.id);
        this.state.wires = this.state.wires.filter(wire => wire.from.componentId !== selected.id && wire.to.componentId !== selected.id);
        this.componentElements.get(selected.id)?.remove(); this.componentElements.delete(selected.id);
      } else this.state.wires = this.state.wires.filter(wire => wire.id !== selected.id);
      this.state.selected = null; this.renderAll(); this.commitHistory();
    }

    renderAll() { this.renderComponents(); this.renderPins(); this.renderWires(); this.updateInspector(); this.applyCamera(); }

    snapshot() {
      return {
        version: '2.0.8', components: deepClone(this.state.components.map(model => ({...model, customManifest: undefined}))),
        wires: deepClone(this.state.wires), camera: deepClone(this.state.camera), showGrid: this.state.showGrid,
        code: this.getCode()
      };
    }

    commitHistory() {
      const snapshot = this.snapshot();
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(snapshot); if (this.history.length > 60) this.history.shift();
      this.historyIndex = this.history.length - 1;
    }

    undo() { if (this.historyIndex <= 0) return; this.historyIndex--; this.loadProject(deepClone(this.history[this.historyIndex]), false); }
    redo() { if (this.historyIndex >= this.history.length - 1) return; this.historyIndex++; this.loadProject(deepClone(this.history[this.historyIndex]), false); }

    clearCanvas() {
      this.runtime.stop(); this.state.components = []; this.state.wires = []; this.state.selected = null; this.draftWire = null;
      this.componentElements.clear(); this.componentLayer.innerHTML = ''; this.pinLayer.innerHTML = ''; this.wirePaths.innerHTML = ''; this.wireHandles.innerHTML = '';
    }

    loadProject(project, commit = true) {
      this.clearCanvas();
      this.state.camera = project.camera || {x: 0, y: 0, scale: 1}; this.state.showGrid = project.showGrid !== false;
      (project.components || []).forEach(part => this.addComponent(part.catalogId, part.x, part.y, {...part, silent: true}));
      this.state.wires = deepClone(project.wires || []); this.setCode(project.code || this.examples.blink.code);
      this.renderAll(); setTimeout(() => this.fitAll(), 150); if (commit) this.commitHistory();
    }

    newProject() { if (!window.confirm('Create a new blank project?')) return; this.clearCanvas(); this.setCode('void setup() {\n\n}\n\nvoid loop() {\n\n}'); this.renderAll(); this.commitHistory(); }

    loadExample(id, commit = true) {
      const example = this.examples[id]; if (!example) return;
      this.clearCanvas(); this.setCode(example.code);
      example.parts.forEach(part => this.addComponent(part.catalogId, part.x, part.y, {...part, silent: true}));
      this.state.camera = {x: 20, y: 20, scale: 1}; this.renderAll(); setTimeout(() => this.fitAll(), 350); if (commit) this.commitHistory();
    }

    saveProject() {
      localStorage.setItem(`egas-project-${this.settings.instanceId}`, JSON.stringify(this.snapshot())); this.toast('Project saved in this browser');
    }

    exportProject() {
      const blob = new Blob([JSON.stringify(this.snapshot(), null, 2)], {type: 'application/json'});
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `arduino-project-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
    }

    importProject(file) {
      const reader = new FileReader(); reader.onload = () => {
        try { this.loadProject(JSON.parse(reader.result), true); this.toast('Project imported'); }
        catch (error) { this.toast(`Import failed: ${error.message}`, 'error'); }
      }; reader.readAsText(file);
    }

    runSimulation() {
      this.activateTab('serial'); this.serialOutput.textContent = ''; this.compileStatus.textContent = 'Compiling…';
      $('[data-action="run"]', this.root).disabled = true; $('[data-action="stop"]', this.root).disabled = false;
      this.runtime.run(this.getCode()).then(() => {
        this.compileStatus.textContent = 'Stopped';
      }).catch(error => {
        if (!/Simulation stopped/.test(error.message)) { this.compileStatus.textContent = error.message; this.toast(error.message, 'error'); }
      }).finally(() => {
        $('[data-action="run"]', this.root).disabled = false; $('[data-action="stop"]', this.root).disabled = true;
      });
      this.compileStatus.textContent = 'Running';
    }

    stopSimulation() { this.runtime.stop(); this.compileStatus.textContent = 'Stopped'; $('[data-action="run"]', this.root).disabled = false; $('[data-action="stop"]', this.root).disabled = true; }
    serial(text) { this.serialOutput.textContent += text; this.serialOutput.scrollTop = this.serialOutput.scrollHeight; }

    findBoard() { return this.state.components.find(model => ['arduino-uno','arduino-mega','arduino-nano','esp32-devkit','pi-pico','nano-rp2040','franzininho','attiny85'].includes(model.catalogId)); }
    boardPinName(pin) { return typeof pin === 'number' || /^\d+$/.test(String(pin)) ? String(pin) : String(pin).replace(/^A(\d+)$/i, 'A$1'); }

    writeBoardPin(pin, value, mode) {
      const board = this.findBoard(); if (!board) return;
      const pinName = this.boardPinName(pin); board.pinValues[pinName] = value;
      this.propagateValue(board.id, pinName, value, mode);
    }

    readBoardPin(pin, mode) {
      const board = this.findBoard(); if (!board) return 0;
      const pinName = this.boardPinName(pin); const result = this.findConnectedInput(board.id, pinName, mode);
      if (result !== null) return mode === 'analog' ? clamp(Math.round(Number(result) || 0), 0, 1023) : Number(result) ? 1 : 0;
      const pinMode = this.runtime.pinModes.get(pinName); return pinMode === 'INPUT_PULLUP' ? 1 : 0;
    }

    graphNeighbors(componentId, pinName) {
      const key = `${componentId}:${pinName}`; const neighbors = [];
      this.state.wires.forEach(wire => {
        const from = `${wire.from.componentId}:${wire.from.pin}`, to = `${wire.to.componentId}:${wire.to.pin}`;
        if (from === key) neighbors.push(wire.to); if (to === key) neighbors.push(wire.from);
      });
      const model = this.getComponent(componentId); const pin = model?.pins.find(item => item.name === pinName);
      if (model && pin?.connectorId) {
        model.buses.forEach(bus => {
          if (bus.includes(pin.connectorId)) bus.filter(id => id !== pin.connectorId).forEach(id => {
            const other = model.pins.find(item => item.connectorId === id); if (other) neighbors.push({componentId, pin: other.name});
          });
        });
      }
      return neighbors;
    }

    propagateValue(componentId, pinName, value, mode, visited = new Set()) {
      const key = `${componentId}:${pinName}`; if (visited.has(key)) return; visited.add(key);
      const model = this.getComponent(componentId); if (model) { model.pinValues[pinName] = value; this.applyVisualPinValue(model, pinName, value, mode, visited); }
      this.graphNeighbors(componentId, pinName).forEach(neighbor => this.propagateValue(neighbor.componentId, neighbor.pin, value, mode, visited));
    }

    applyVisualPinValue(model, pinName, value, mode, visited) {
      const catalog = this.getCatalog(model.catalogId); const element = this.componentElements.get(model.id); if (!catalog || !element) return;
      const part = element.querySelector('.egas-wokwi-part');
      if (model.catalogId === 'led') {
        const brightness = mode === 'pwm' ? clamp(Number(value), 0, 255) : (Number(value) ? 255 : 0);
        if (part) { try { part.value = brightness > 0; part.brightness = brightness; } catch (_) {} }
        element.style.setProperty('--egas-output', String(brightness / 255));
      } else if (model.catalogId === 'relay-module' || model.catalogId.includes('relay')) {
        const active = Number(value) > 0; if (part) { try { part.value = active; part.energized = active; } catch (_) {} }
        element.classList.toggle('is-active-output', active);
      } else if (model.catalogId === 'servo') {
        const angle = mode === 'pwm' ? clamp(Math.round(Number(value) / 255 * 180), 0, 180) : clamp(Number(value), 0, 180);
        if (part) { try { part.angle = angle; } catch (_) {} }
      } else if (model.catalogId === 'buzzer') {
        const active = Number(value) > 0; if (part) { try { part.value = active; part.frequency = mode === 'tone' ? Number(value) : 440; } catch (_) {} }
      } else if (model.catalogId === 'tt-motor-real') {
        this.updateTTMotor(model, element);
      } else if (model.catalogId === 'l298n-real') {
        this.updateL298N(model, visited);
      }
    }

    updateTTMotor(model, element) {
      const plus = Number(model.pinValues['M+'] || 0), minus = Number(model.pinValues['M−'] || 0);
      const speed = Math.abs(plus - minus); const direction = plus === minus ? 0 : plus > minus ? 1 : -1;
      element.classList.toggle('motor-forward', direction > 0); element.classList.toggle('motor-reverse', direction < 0); element.classList.toggle('motor-stopped', direction === 0);
      element.style.setProperty('--motor-speed', `${Math.max(.16, 1.5 - clamp(speed, 0, 255) / 255 * 1.3)}s`);
    }

    updateL298N(model, visited) {
      const high = name => Number(model.pinValues[name] || 0) > 0;
      const pwm = name => clamp(Number(model.pinValues[name] || 0), 0, 255);
      const ena = pwm('ENA') || (high('ENA') ? 255 : 0), enb = pwm('ENB') || (high('ENB') ? 255 : 0);
      const out1 = ena && high('IN1') && !high('IN2') ? ena : 0;
      const out2 = ena && high('IN2') && !high('IN1') ? ena : 0;
      const out3 = enb && high('IN3') && !high('IN4') ? enb : 0;
      const out4 = enb && high('IN4') && !high('IN3') ? enb : 0;
      [['OUT1', out1], ['OUT2', out2], ['OUT3', out3], ['OUT4', out4]].forEach(([pin, value]) => {
        model.pinValues[pin] = value;
        this.graphNeighbors(model.id, pin).forEach(neighbor => this.propagateValue(neighbor.componentId, neighbor.pin, value, 'pwm', visited));
      });
    }

    findConnectedInput(componentId, pinName, mode) {
      const queue = [{componentId, pin: pinName}], visited = new Set();
      while (queue.length) {
        const current = queue.shift(), key = `${current.componentId}:${current.pin}`; if (visited.has(key)) continue; visited.add(key);
        const model = this.getComponent(current.componentId);
        if (model && current.componentId !== componentId) {
          if (model.interactiveValue !== undefined) return mode === 'analog' ? this.normalizeAnalog(model.interactiveValue) : Number(model.interactiveValue) ? 1 : 0;
          if (model.pinValues[current.pin] !== undefined) return model.pinValues[current.pin];
          if (model.attrs.value !== undefined) return model.attrs.value;
          if (model.attrs.temperature !== undefined && mode === 'analog') return this.normalizeAnalog(model.attrs.temperature);
        }
        this.graphNeighbors(current.componentId, current.pin).forEach(next => { if (!visited.has(`${next.componentId}:${next.pin}`)) queue.push(next); });
      }
      return null;
    }

    normalizeAnalog(value) { const number = Number(value) || 0; return number <= 1 ? Math.round(number * 1023) : number <= 255 ? Math.round(number / 255 * 1023) : clamp(Math.round(number), 0, 1023); }

    toast(message, type = 'success') {
      const toast = document.createElement('div'); toast.className = `egas-toast is-${type}`; toast.textContent = message; this.toastRegion.appendChild(toast);
      setTimeout(() => toast.classList.add('is-visible'), 20); setTimeout(() => { toast.classList.remove('is-visible'); setTimeout(() => toast.remove(), 250); }, 3200);
    }
  }

  function boot() {
    document.querySelectorAll('.egas-app[data-egas-instance]').forEach(root => {
      if (root.dataset.egasReady) return;
      const id = root.dataset.egasInstance, settings = window.EGAS_INSTANCES && window.EGAS_INSTANCES[id];
      if (!settings) return;
      root.dataset.egasReady = '1';
      try { new EGArduinoSimulator(root, settings); }
      catch (error) { console.error('[EGAS]', error); root.innerHTML = `<div class="egas-fatal"><strong>Simulator failed to start</strong><pre>${escapeHtml(error.stack || error.message)}</pre></div>`; }
    });
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
