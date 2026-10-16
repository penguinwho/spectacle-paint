/* Spectacle Paint — dependency-free canvas drawing engine. */
(() => {
  'use strict';
  const SHAPES = new Set(['line', 'rectangle', 'ellipse', 'roundedRect']);
  const STROKES = new Set(['pencil', 'brush', 'eraser', 'airbrush']);
  const makeCanvas = (width, height) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(width));
    c.height = Math.max(1, Math.round(height));
    return c;
  };
  const dimension = n => Math.max(1, Math.min(6000, Math.round(Number(n) || 1)));
  const bounds = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });

  class PaintEngine {
    constructor(canvas, overlayCanvas, callbacks = {}) {
      this.canvas = canvas;
      this.overlay = overlayCanvas;
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
      this.ox = overlayCanvas.getContext('2d');
      this.callbacks = callbacks;
      this.tool = 'pencil';
      this.fg = '#000000';
      this.bg = '#ffffff';
      this.size = 3;
      this.shapeMode = 'outline';
      this.zoom = 1;
      this.dirty = false;
      this.undoStack = [];
      this.redoStack = [];
      this.selection = null;
      this.gesture = null;
      this.polygon = null;
      this.curve = null;
      this.lastPosition = { x: 0, y: 0 };
      this.handlers = {
        pointerdown: e => this._down(e),
        pointermove: e => this._move(e),
        pointerup: e => this._up(e),
        pointercancel: e => this._up(e),
        dblclick: e => { if (this.tool === 'polygon') { e.preventDefault(); this._finishPolygon(); } },
        contextmenu: e => e.preventDefault()
      };
      for (const [type, handler] of Object.entries(this.handlers)) this.overlay.addEventListener(type, handler);
      this.keyHandler = e => {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
        if (e.key === 'Escape') {
          if (this.polygon || this.curve || this.gesture) { this._cancelGesture(); e.preventDefault(); }
          else if (this.selection) { this.commitSelection(); e.preventDefault(); }
        } else if (e.key === 'Enter') {
          if (this.polygon) { this._finishPolygon(); e.preventDefault(); }
          else if (this.curve) { this._finishCurve(); e.preventDefault(); }
        }
      };
      document.addEventListener('keydown', this.keyHandler);
      this.overlay.style.touchAction = 'none';
      this.newDocument(canvas.width || 900, canvas.height || 560);
    }

    get state() {
      const s = this.selection;
      return {
        canUndo: this.undoStack.length > 0,
        canRedo: this.redoStack.length > 0,
        width: this.canvas.width,
        height: this.canvas.height,
        dirty: this.dirty,
        selection: s ? { x: s.x, y: s.y, width: s.w, height: s.h } : null,
        tool: this.tool,
        zoom: this.zoom
      };
    }
    getState() { return this.state; }
    _notify(extra = {}) { this.callbacks.onChange?.({ ...this.state, ...extra }); }
    _changed() { this.dirty = true; this._notify(); }
    _point(e) {
      const r = this.overlay.getBoundingClientRect();
      return { x: (e.clientX - r.left) * this.canvas.width / r.width, y: (e.clientY - r.top) * this.canvas.height / r.height };
    }
    _clamp(p) { return { x: Math.max(0, Math.min(this.canvas.width, p.x)), y: Math.max(0, Math.min(this.canvas.height, p.y)) }; }
    _composite() {
      const c = makeCanvas(this.canvas.width, this.canvas.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(this.canvas, 0, 0);
      if (this.selection?.cut) ctx.drawImage(this.selection.image, this.selection.x, this.selection.y);
      return c;
    }
    _snapshot() {
      const c = this._composite();
      return { width: c.width, height: c.height, pixels: c.getContext('2d').getImageData(0, 0, c.width, c.height), dirty: this.dirty };
    }
    _pushUndo() {
      this.undoStack.push(this._snapshot());
      if (this.undoStack.length > 20) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    _setDimensions(w, h) {
      this.canvas.width = this.overlay.width = dimension(w);
      this.canvas.height = this.overlay.height = dimension(h);
      this.ctx.imageSmoothingEnabled = false;
      this.ox.imageSmoothingEnabled = false;
    }
    _restore(snapshot) {
      this._cancelGesture();
      this.selection = null;
      this._setDimensions(snapshot.width, snapshot.height);
      this.ctx.putImageData(snapshot.pixels, 0, 0);
      this.dirty = snapshot.dirty;
      this._notify();
    }
    undo() {
      if (!this.undoStack.length) return;
      this.redoStack.push(this._snapshot());
      this._restore(this.undoStack.pop());
    }
    redo() {
      if (!this.redoStack.length) return;
      this.undoStack.push(this._snapshot());
      this._restore(this.redoStack.pop());
    }
    setTool(tool) {
      if (this.tool === tool) return;
      if (this.polygon) this._finishPolygon();
      if (this.curve) this._finishCurve();
      this._cancelGesture();
      this.commitSelection();
      this.tool = tool;
      this._notify();
    }
    setColors(fg, bg) { if (fg) this.fg = fg; if (bg) this.bg = bg; }
    setSize(size) { this.size = Math.max(1, Math.min(100, Number(size) || 1)); }
    setShapeMode(mode) { this.shapeMode = ['outline', 'filled-outline', 'filled'].includes(mode) ? mode : 'outline'; }
    setZoom(zoom) {
      this.zoom = Math.max(0.25, Math.min(8, Number(zoom) || 1));
      this.callbacks.onZoom?.(this.zoom);
      this._notify();
    }
    newDocument(w = 900, h = 560) {
      this._cancelGesture();
      this.selection = null;
      this._setDimensions(w, h);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.undoStack.length = this.redoStack.length = 0;
      this.dirty = false;
      this._notify();
    }
    clear() {
      this._cancelGesture();
      this.commitSelection();
      this._pushUndo();
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this._changed();
    }
    loadImage(image) {
      this._cancelGesture();
      this.commitSelection();
      this._pushUndo();
      this._setDimensions(image.naturalWidth || image.width, image.naturalHeight || image.height);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
      this._changed();
    }
    resize(w, h) {
      this._cancelGesture(); this.commitSelection(); this._pushUndo();
      const original = this._composite();
      this._setDimensions(w, h);
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(original, 0, 0);
      this._changed();
    }
    rotate(degrees = 90) {
      this._cancelGesture(); this.commitSelection(); this._pushUndo();
      const original = this._composite();
      const angle = Number(degrees) * Math.PI / 180;
      const sin = Math.abs(Math.sin(angle)), cos = Math.abs(Math.cos(angle));
      this._setDimensions(Math.round(original.width * cos + original.height * sin), Math.round(original.width * sin + original.height * cos));
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.save();
      this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.rotate(angle);
      this.ctx.drawImage(original, -original.width / 2, -original.height / 2);
      this.ctx.restore();
      this._changed();
    }
    flip(horizontal = true) {
      this._cancelGesture(); this.commitSelection(); this._pushUndo();
      const original = this._composite();
      this.ctx.save();
      this.ctx.translate(horizontal ? this.canvas.width : 0, horizontal ? 0 : this.canvas.height);
      this.ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
      this.ctx.drawImage(original, 0, 0);
      this.ctx.restore();
      this._changed();
    }
    invert() {
      this._cancelGesture(); this.commitSelection(); this._pushUndo();
      const pixels = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        pixels.data[i] = 255 - pixels.data[i]; pixels.data[i + 1] = 255 - pixels.data[i + 1]; pixels.data[i + 2] = 255 - pixels.data[i + 2];
      }
      this.ctx.putImageData(pixels, 0, 0);
      this._changed();
    }
    exportPNG() { return this._composite().toDataURL('image/png'); }
    addText(text, x, y, options = {}) {
      if (!text) return;
      this.commitSelection(); this._pushUndo();
      const size = Math.max(6, Number(options.size) || 18);
      this.ctx.save();
      this.ctx.fillStyle = this.fg;
      this.ctx.font = `${options.italic ? 'italic ' : ''}${options.bold ? 'bold ' : ''}${size}px ${options.font || 'Arial'}`;
      this.ctx.textBaseline = 'top';
      String(text).split('\n').forEach((line, index) => this.ctx.fillText(line, x, y + index * size * 1.2));
      this.ctx.restore();
      this._changed();
    }

    _selectionPath(ctx, s) {
      ctx.beginPath();
      if (s.points) {
        s.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.closePath();
      } else ctx.rect(s.x, s.y, s.w, s.h);
    }
    _captureSelection(rect, points = null) {
      const x = Math.max(0, Math.floor(rect.x)), y = Math.max(0, Math.floor(rect.y));
      const w = Math.min(this.canvas.width - x, Math.ceil(rect.w)), h = Math.min(this.canvas.height - y, Math.ceil(rect.h));
      if (w < 1 || h < 1) { this.selection = null; this._renderOverlay(); this._notify(); return; }
      const image = makeCanvas(w, h), ctx = image.getContext('2d');
      if (points) {
        ctx.save(); ctx.translate(-x, -y); this._selectionPath(ctx, { points }); ctx.clip(); ctx.translate(x, y);
      }
      ctx.drawImage(this.canvas, x, y, w, h, 0, 0, w, h);
      if (points) ctx.restore();
      this.selection = { x, y, w, h, image, points, cut: false };
      this._renderOverlay(); this._notify();
    }
    _eraseSelection(s) {
      this.ctx.save();
      this._selectionPath(this.ctx, s);
      this.ctx.fillStyle = this.bg;
      this.ctx.fill();
      this.ctx.restore();
    }
    commitSelection() {
      const s = this.selection;
      if (!s) return;
      if (s.cut) this.ctx.drawImage(s.image, s.x, s.y);
      this.selection = null;
      this._renderOverlay(); this._notify();
    }
    selectAll() {
      this._cancelGesture(); this.commitSelection();
      this.tool = 'select';
      this._captureSelection({ x: 0, y: 0, w: this.canvas.width, h: this.canvas.height });
    }
    copySelection() {
      if (!this.selection) return null;
      const copy = makeCanvas(this.selection.w, this.selection.h);
      copy.getContext('2d').drawImage(this.selection.image, 0, 0);
      return copy;
    }
    cutSelection() {
      const copy = this.copySelection();
      if (copy) this.deleteSelection();
      return copy;
    }
    deleteSelection() {
      const s = this.selection;
      if (!s) return;
      this._pushUndo();
      if (!s.cut) this._eraseSelection(s);
      this.selection = null;
      this._renderOverlay(); this._changed();
    }
    pasteImage(image) {
      this._cancelGesture(); this.commitSelection(); this._pushUndo();
      const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
      const copy = makeCanvas(w, h);
      copy.getContext('2d').drawImage(image, 0, 0);
      this.selection = { x: 10, y: 10, w, h, image: copy, points: null, cut: true };
      this.tool = 'select';
      this._renderOverlay(); this._changed();
    }
    crop() {
      const s = this.selection;
      if (!s) return;
      this._pushUndo();
      const image = this.copySelection();
      this.selection = null;
      this._setDimensions(s.w, s.h);
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, s.w, s.h);
      this.ctx.drawImage(image, 0, 0);
      this._changed();
    }

    _down(e) {
      if (e.button !== 0 && e.button !== 2) return;
      e.preventDefault();
      const p = this._clamp(this._point(e));
      const color = e.button === 2 ? this.bg : this.fg;
      this.lastPosition = p;
      this.overlay.setPointerCapture?.(e.pointerId);
      if (this.tool === 'polygon') {
        if (!this.polygon) { this.commitSelection(); this.polygon = { points: [p], color }; }
        else {
          const last = this.polygon.points[this.polygon.points.length - 1];
          if (Math.hypot(p.x - last.x, p.y - last.y) > 1) this.polygon.points.push(p);
        }
        this._renderOverlay(p); return;
      }
      if (this.tool === 'curve' && this.curve) {
        this.curve.control = p;
        this.gesture = { kind: 'curve-control', start: p, last: p, pointerId: e.pointerId };
        this._renderOverlay(); return;
      }
      if ((this.tool === 'select' || this.tool === 'freeSelect') && this.selection) {
        const s = this.selection;
        if (p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) {
          this._pushUndo();
          if (!s.cut) { this._eraseSelection(s); s.cut = true; }
          this.gesture = { kind: 'move-selection', start: p, original: { x: s.x, y: s.y }, pointerId: e.pointerId };
          this._renderOverlay(); return;
        }
      }
      this.commitSelection();
      if (this.tool === 'fill') { this._fill(p, color); return; }
      if (this.tool === 'picker') {
        const x = Math.min(this.canvas.width - 1, Math.floor(p.x)), y = Math.min(this.canvas.height - 1, Math.floor(p.y));
        const d = this.ctx.getImageData(x, y, 1, 1).data;
        const pickedColor = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
        if (e.button === 2) this.bg = pickedColor; else this.fg = pickedColor;
        this._notify({ pickedColor, pickedBackground: e.button === 2 }); return;
      }
      if (this.tool === 'text') { this.callbacks.onText?.({ x: Math.round(p.x), y: Math.round(p.y) }); return; }
      if (this.tool === 'zoom') { this.setZoom(e.button === 2 ? this.zoom / 2 : this.zoom >= 8 ? 1 : this.zoom * 2); return; }
      this.gesture = { kind: this.tool, start: p, last: p, color, points: [p], shift: e.shiftKey, pointerId: e.pointerId };
      if (STROKES.has(this.tool)) {
        this._pushUndo();
        if (this.tool === 'airbrush') {
          this._spray(p, color);
          this.sprayTimer = setInterval(() => { if (this.gesture) this._spray(this.gesture.last, this.gesture.color); }, 35);
        } else this._stroke(p, p, this.tool, color);
        this._changed();
      } else this._renderOverlay();
    }
    _move(e) {
      const p = this._point(e);
      this.lastPosition = p;
      this.callbacks.onPosition?.({ x: Math.floor(p.x), y: Math.floor(p.y) });
      if (this.polygon) { this._renderOverlay(p); return; }
      const g = this.gesture;
      if (!g || (g.pointerId !== undefined && g.pointerId !== e.pointerId)) {
        if (this.curve) { this.curve.control = p; this._renderOverlay(); }
        return;
      }
      g.shift = e.shiftKey;
      if (g.kind === 'move-selection') {
        this.selection.x = Math.round(g.original.x + p.x - g.start.x);
        this.selection.y = Math.round(g.original.y + p.y - g.start.y);
        this._renderOverlay();
      } else if (g.kind === 'curve-control') {
        this.curve.control = p; this._renderOverlay();
      } else if (STROKES.has(g.kind)) {
        if (g.kind === 'airbrush') this._spray(p, g.color);
        else this._stroke(g.last, p, g.kind, g.color);
      } else {
        if (g.kind === 'freeSelect') g.points.push(this._clamp(p));
        g.last = this._clamp(p); this._renderOverlay();
      }
      g.last = p;
    }
    _up(e) {
      const g = this.gesture;
      clearInterval(this.sprayTimer); this.sprayTimer = null;
      if (!g || (g.pointerId !== undefined && g.pointerId !== e.pointerId)) return;
      const p = this._clamp(this._point(e));
      g.last = p; g.shift = e.shiftKey;
      this.gesture = null;
      if (STROKES.has(g.kind)) { this._changed(); }
      else if (g.kind === 'move-selection') { this._changed(); }
      else if (g.kind === 'curve-control') { this._finishCurve(); }
      else if (g.kind === 'select') this._captureSelection(bounds(g.start, p));
      else if (g.kind === 'freeSelect') {
        g.points.push(p);
        const xs = g.points.map(v => v.x), ys = g.points.map(v => v.y);
        this._captureSelection({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }, g.points);
      } else if (g.kind === 'curve') {
        this.curve = { start: g.start, end: this._constrain(g.start, p, 'line', g.shift), control: { x: (g.start.x + p.x) / 2, y: (g.start.y + p.y) / 2 }, color: g.color };
      } else if (SHAPES.has(g.kind)) { this._pushUndo(); this._drawShape(this.ctx, g); this._changed(); }
      this._renderOverlay();
      if (this.overlay.hasPointerCapture?.(e.pointerId)) this.overlay.releasePointerCapture(e.pointerId);
    }
    _cancelGesture() {
      clearInterval(this.sprayTimer); this.sprayTimer = null;
      this.gesture = this.polygon = this.curve = null;
      if (this.ox) this._renderOverlay();
    }
    _stroke(a, b, kind, color) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = kind === 'eraser' ? this.bg : color;
      ctx.lineWidth = kind === 'pencil' ? 1 : kind === 'eraser' ? Math.max(4, this.size * 3) : this.size;
      ctx.lineCap = kind === 'eraser' ? 'square' : 'round';
      ctx.lineJoin = 'round';
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.1) {
        if (kind === 'eraser') ctx.fillRect(a.x - ctx.lineWidth / 2, a.y - ctx.lineWidth / 2, ctx.lineWidth, ctx.lineWidth);
        else if (kind === 'pencil') ctx.fillRect(Math.floor(a.x), Math.floor(a.y), 1, 1);
        else { ctx.beginPath(); ctx.arc(a.x, a.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
      } else { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.restore();
    }
    _spray(p, color) {
      const radius = Math.max(5, this.size * 3);
      this.ctx.fillStyle = color;
      for (let i = 0; i < Math.max(10, radius * 1.5); i++) {
        const angle = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
        this.ctx.fillRect(Math.floor(p.x + Math.cos(angle) * r), Math.floor(p.y + Math.sin(angle) * r), 1, 1);
      }
    }
    _constrain(start, end, kind, shift) {
      if (!shift) return end;
      const dx = end.x - start.x, dy = end.y - start.y;
      if (kind === 'line') {
        const theta = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4;
        const distance = Math.hypot(dx, dy);
        return { x: start.x + Math.cos(theta) * distance, y: start.y + Math.sin(theta) * distance };
      }
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      return { x: start.x + (dx < 0 ? -size : size), y: start.y + (dy < 0 ? -size : size) };
    }
    _paintPath(ctx, color, line = false) {
      ctx.lineWidth = this.size;
      ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.fillStyle = this.shapeMode === 'filled-outline' ? this.bg : color;
      if (!line && this.shapeMode !== 'outline') ctx.fill();
      if (line || this.shapeMode !== 'filled') ctx.stroke();
    }
    _drawShape(ctx, g) {
      const p = this._constrain(g.start, g.last, g.kind, g.shift);
      const r = bounds(g.start, p);
      ctx.save(); ctx.beginPath();
      if (g.kind === 'line') { ctx.moveTo(g.start.x, g.start.y); ctx.lineTo(p.x, p.y); }
      else if (g.kind === 'rectangle') ctx.rect(r.x, r.y, r.w, r.h);
      else if (g.kind === 'ellipse') ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.1, r.w / 2), Math.max(0.1, r.h / 2), 0, 0, Math.PI * 2);
      else if (g.kind === 'roundedRect') {
        const radius = Math.min(16, r.w / 4, r.h / 4);
        ctx.moveTo(r.x + radius, r.y); ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, radius);
        ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, radius);
        ctx.arcTo(r.x, r.y + r.h, r.x, r.y, radius); ctx.arcTo(r.x, r.y, r.x + r.w, r.y, radius); ctx.closePath();
      }
      this._paintPath(ctx, g.color, g.kind === 'line'); ctx.restore();
    }
    _drawCurve(ctx, c) {
      ctx.save(); ctx.beginPath(); ctx.moveTo(c.start.x, c.start.y);
      ctx.quadraticCurveTo(c.control.x, c.control.y, c.end.x, c.end.y);
      this._paintPath(ctx, c.color, true); ctx.restore();
    }
    _finishCurve() {
      if (!this.curve) return;
      this._pushUndo(); this._drawCurve(this.ctx, this.curve); this.curve = null;
      this._renderOverlay(); this._changed();
    }
    _drawPolygon(ctx, polygon, cursor, close = false) {
      if (!polygon.points.length) return;
      ctx.save(); ctx.beginPath();
      polygon.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      if (cursor) ctx.lineTo(cursor.x, cursor.y);
      if (close) ctx.closePath();
      this._paintPath(ctx, polygon.color, !close); ctx.restore();
    }
    _finishPolygon() {
      if (!this.polygon) return;
      if (this.polygon.points.length > 1) {
        this._pushUndo(); this._drawPolygon(this.ctx, this.polygon, null, true); this._changed();
      }
      this.polygon = null; this._renderOverlay();
    }
    _marquee(ctx, rect, points = null) {
      ctx.save(); ctx.lineWidth = 1;
      const path = () => {
        ctx.beginPath();
        if (points?.length) { points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); }
        else ctx.rect(Math.round(rect.x) + 0.5, Math.round(rect.y) + 0.5, Math.round(rect.w), Math.round(rect.h));
      };
      ctx.strokeStyle = '#fff'; ctx.setLineDash([]); path(); ctx.stroke();
      ctx.strokeStyle = '#000'; ctx.setLineDash([4, 4]); path(); ctx.stroke(); ctx.restore();
    }
    _renderOverlay(cursor = null) {
      const ctx = this.ox;
      ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      const s = this.selection;
      if (s) {
        if (s.cut) ctx.drawImage(s.image, s.x, s.y);
        this._marquee(ctx, s, s.cut ? null : s.points);
      }
      if (this.polygon) this._drawPolygon(ctx, this.polygon, cursor || this.lastPosition);
      if (this.curve) this._drawCurve(ctx, this.curve);
      const g = this.gesture;
      if (!g) return;
      if (SHAPES.has(g.kind)) this._drawShape(ctx, g);
      else if (g.kind === 'curve') this._drawShape(ctx, { ...g, kind: 'line' });
      else if (g.kind === 'select') this._marquee(ctx, bounds(g.start, g.last));
      else if (g.kind === 'freeSelect') this._marquee(ctx, null, g.points);
    }
    _fill(p, color) {
      const width = this.canvas.width, height = this.canvas.height;
      const x = Math.max(0, Math.min(width - 1, Math.floor(p.x))), y = Math.max(0, Math.min(height - 1, Math.floor(p.y)));
      const pixels = this.ctx.getImageData(0, 0, width, height), data = pixels.data;
      const sample = makeCanvas(1, 1).getContext('2d'); sample.fillStyle = color; sample.fillRect(0, 0, 1, 1);
      const replacement = sample.getImageData(0, 0, 1, 1).data;
      const index = (y * width + x) * 4, original = data.slice(index, index + 4);
      if (original.every((v, i) => v === replacement[i])) return;
      this._pushUndo();
      const queue = new Int32Array(width * height);
      let head = 0, tail = 0;
      const matches = i => data[i] === original[0] && data[i + 1] === original[1] && data[i + 2] === original[2] && data[i + 3] === original[3];
      const put = pixel => {
        const i = pixel * 4;
        if (!matches(i)) return;
        data[i] = replacement[0]; data[i + 1] = replacement[1]; data[i + 2] = replacement[2]; data[i + 3] = replacement[3];
        queue[tail++] = pixel;
      };
      put(y * width + x);
      while (head < tail) {
        const pixel = queue[head++], px = pixel % width;
        if (px > 0) put(pixel - 1);
        if (px < width - 1) put(pixel + 1);
        if (pixel >= width) put(pixel - width);
        if (pixel < width * (height - 1)) put(pixel + width);
      }
      this.ctx.putImageData(pixels, 0, 0); this._changed();
    }
    destroy() {
      this._cancelGesture();
      for (const [type, handler] of Object.entries(this.handlers)) this.overlay.removeEventListener(type, handler);
      document.removeEventListener('keydown', this.keyHandler);
    }
  }
  window.PaintEngine = PaintEngine;
})();
