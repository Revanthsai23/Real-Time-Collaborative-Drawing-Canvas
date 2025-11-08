// Canvas drawing functionality
export class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentPath = [];

        // For streaming small segments while drawing with point collection
        this.lastX = 0;
        this.lastY = 0;
        this.lastSentTime = 0;
        this.minSegmentInterval = 12; // ms (~80 FPS for smoother feel)
        this.onSegment = null; // callback(segment)
        this.pointBuffer = []; // Buffer for collecting points for smooth interpolation
        this.maxBufferSize = 5; // Maximum points to buffer before smoothing
        
        // User layer buffers for conflict-free simultaneous drawing
        this.userLayers = new Map(); // userId -> { canvas, ctx, lastUpdate, lastTimestamp }
        this.mainCanvas = this.canvas; // Reference to main canvas
        this.mergeInterval = null; // For periodic layer merging
        this.compositeInterval = null; // For real-time layer compositing
        
        // Drawing mode: 'brush' or 'eraser'
        this.mode = 'brush';
        
        // Canvas sizing - full screen
        this.resizeCanvas();
        window.addEventListener('resize', () => {
            // Use a small delay to ensure layout has updated
            setTimeout(() => this.resizeCanvas(), 10);
        });
        
        // Drawing styles
        this.color = '#000000';
        this.lineWidth = 5;
        
        // Cursor indicators for other users
        this.cursorIndicators = new Map();
        
        // Zoom and pan state
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastPanPoint = { x: 0, y: 0 };
        
        // Canvas dimensions (virtual canvas size)
        this.canvasWidth = 3000;
        this.canvasHeight = 2000;

    // Incoming completed strokes queue for deterministic processing
    this.incomingStrokes = [];
    this._processingIncoming = false;

    // Start processing incoming queue
    this._processIncomingQueue = this._processIncomingQueue.bind(this);
    requestAnimationFrame(this._processIncomingQueue);
        
        // Event listeners
        this.setupEventListeners();
        
        // Callback for zoom changes
        this.onZoomChange = null;
        
        // Initial transform and background
        this.applyTransform();
        this.clear(); // Initialize with background
        
        // Start real-time layer compositing for immediate visual feedback
        this.startRealTimeCompositing();
        
        // Start periodic layer merging for persistence
        this.startLayerMerging();
    }
    
    // Start real-time compositing (faster than merging for visual feedback)
    startRealTimeCompositing() {
        if (this.compositeInterval) return;
        
        // Use requestAnimationFrame for smoother, frame-synced updates
        const compositeLoop = () => {
            this.compositeAllLayers();
            this.compositeInterval = requestAnimationFrame(compositeLoop);
        };
        this.compositeInterval = requestAnimationFrame(compositeLoop);
    }
    
    // Composite all layers visually (for real-time display)
    compositeAllLayers() {
        if (this.userLayers.size === 0) return;
        
        // Layers are already visible as separate canvas elements
        // This function ensures they stay in sync with transforms
        // The actual visual compositing happens via CSS z-index stacking
        // We just need to ensure transforms are updated
        this.userLayers.forEach((layerData) => {
            const { ctx: layerCtx } = layerData;
            const container = this.canvas.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                const centerX = containerRect.width / 2;
                const centerY = containerRect.height / 2;
                
                layerCtx.setTransform(
                    dpr * this.zoom, 0, 0, dpr * this.zoom,
                    dpr * (centerX + this.panX - (this.canvasWidth / 2) * this.zoom),
                    dpr * (centerY + this.panY - (this.canvasHeight / 2) * this.zoom)
                );
            }
        });
    }
    
    // Get or create a user layer buffer
    getUserLayer(userId) {
        if (!this.userLayers.has(userId)) {
            const layer = document.createElement('canvas');
            const container = this.canvas.parentElement;
            if (!container) return null;
            
            const containerRect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            layer.width = Math.round(containerRect.width * dpr);
            layer.height = Math.round(containerRect.height * dpr);
            layer.style.width = containerRect.width + 'px';
            layer.style.height = containerRect.height + 'px';
            layer.style.position = 'absolute';
            layer.style.pointerEvents = 'none';
            layer.style.zIndex = '1';
            layer.style.top = '0';
            layer.style.left = '0';
            
            // Apply same transform as main canvas
            const layerCtx = layer.getContext('2d');
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            layerCtx.setTransform(
                dpr * this.zoom, 0, 0, dpr * this.zoom,
                dpr * (centerX + this.panX - (this.canvasWidth / 2) * this.zoom),
                dpr * (centerY + this.panY - (this.canvasHeight / 2) * this.zoom)
            );
            
            // Add to container
            container.appendChild(layer);
            this.userLayers.set(userId, { 
                canvas: layer, 
                ctx: layerCtx, 
                lastUpdate: Date.now(),
                lastTimestamp: 0 // Track last processed timestamp for ordering
            });
        }
        return this.userLayers.get(userId);
    }
    
    // Start periodic layer merging (layers are already visible, but we merge to main canvas for persistence)
    startLayerMerging() {
        if (this.mergeInterval) return;
        
        // Merge layers to main canvas periodically for persistence
        // This ensures that completed strokes are saved to the main canvas
        this.mergeInterval = setInterval(() => {
            this.mergeActiveLayers();
        }, 200); // Merge every 200ms to avoid performance issues
    }
    
    // Merge active user layers onto main canvas for persistence
    // Note: Eraser operations are applied directly to main canvas, so we only merge brush layers
    mergeActiveLayers() {
        if (this.userLayers.size === 0) return;
        
        const container = this.canvas.parentElement;
        if (!container) return;
        
        // Use requestAnimationFrame for smoother merging
        requestAnimationFrame(() => {
            // Save current transform
            this.ctx.save();
            const containerRect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            // Reset to identity transform for merging
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            
            // Merge each active user layer (only if updated recently)
            // These are brush operations - eraser operations are already on main canvas
            const now = Date.now();
            this.userLayers.forEach((layerData, userId) => {
                const { canvas: layerCanvas, lastUpdate } = layerData;
                
                // Only merge layers that were active recently (within last 500ms)
                // This prevents merging stale layers while keeping active ones synced
                if (now - lastUpdate < 500) {
                    // Use source-over to merge brush strokes
                    this.ctx.globalCompositeOperation = 'source-over';
                    this.ctx.drawImage(layerCanvas, 0, 0);
                }
            });
            
            // Restore transform
            this.ctx.restore();
            this.applyTransform();
        });
    }
    
    // Clear a user layer
    clearUserLayer(userId) {
        const layerData = this.userLayers.get(userId);
        if (layerData) {
            const { canvas } = layerData;
            const container = this.canvas.parentElement;
            if (container && canvas.parentElement) {
                canvas.remove();
            }
            this.userLayers.delete(userId);
        }
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (!container) return;
        
        // Get container dimensions (canvas wrapper fills remaining space)
        const containerRect = container.getBoundingClientRect();
        // Support high-DPI displays by scaling canvas backing store
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(containerRect.width * dpr);
        this.canvas.height = Math.round(containerRect.height * dpr);
        this.canvas.style.width = containerRect.width + 'px';
        this.canvas.style.height = containerRect.height + 'px';
        
        // Resize all user layers
        this.userLayers.forEach((layerData) => {
            const { canvas: layerCanvas, ctx: layerCtx } = layerData;
            layerCanvas.width = Math.round(containerRect.width * dpr);
            layerCanvas.height = Math.round(containerRect.height * dpr);
            layerCanvas.style.width = containerRect.width + 'px';
            layerCanvas.style.height = containerRect.height + 'px';
            
            // Update layer transform
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            layerCtx.setTransform(
                dpr * this.zoom, 0, 0, dpr * this.zoom,
                dpr * (centerX + this.panX - (this.canvasWidth / 2) * this.zoom),
                dpr * (centerY + this.panY - (this.canvasHeight / 2) * this.zoom)
            );
        });
        
        // Apply zoom and pan transform
        this.applyTransform();
    }
    
    applyTransform() {
        const dpr = window.devicePixelRatio || 1;
        // Center the canvas and apply zoom/pan
        const container = this.canvas.parentElement;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        
        // Calculate center offset
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        
        // Apply transform: translate to center, scale, translate by pan, then scale by DPR
        this.ctx.setTransform(
            dpr * this.zoom, 0, 0, dpr * this.zoom,
            dpr * (centerX + this.panX - (this.canvasWidth / 2) * this.zoom),
            dpr * (centerY + this.panY - (this.canvasHeight / 2) * this.zoom)
        );
        
        // Update all user layer transforms
        this.userLayers.forEach((layerData) => {
            const { ctx: layerCtx } = layerData;
            layerCtx.setTransform(
                dpr * this.zoom, 0, 0, dpr * this.zoom,
                dpr * (centerX + this.panX - (this.canvasWidth / 2) * this.zoom),
                dpr * (centerY + this.panY - (this.canvasHeight / 2) * this.zoom)
            );
        });
    }
    
    setZoom(zoom, centerX = null, centerY = null) {
        const oldZoom = this.zoom;
        this.zoom = Math.max(0.1, Math.min(5.0, zoom));
        
        // If center point provided, adjust pan to zoom around that point
        if (centerX !== null && centerY !== null) {
            const container = this.canvas.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const canvasCenterX = containerRect.width / 2;
                const canvasCenterY = containerRect.height / 2;
                
                // Calculate mouse position in canvas coordinates
                const canvasX = (centerX - canvasCenterX - this.panX) / oldZoom + this.canvasWidth / 2;
                const canvasY = (centerY - canvasCenterY - this.panY) / oldZoom + this.canvasHeight / 2;
                
                // Adjust pan to keep the same point under the mouse
                this.panX = centerX - canvasCenterX - (canvasX - this.canvasWidth / 2) * this.zoom;
                this.panY = centerY - canvasCenterY - (canvasY - this.canvasHeight / 2) * this.zoom;
            }
        }
        
        this.applyTransform();
        if (this.onZoomChange) {
            this.onZoomChange(this.zoom);
        }
    }
    
    zoomIn(centerX = null, centerY = null) {
        this.setZoom(this.zoom * 1.2, centerX, centerY);
    }
    
    zoomOut(centerX = null, centerY = null) {
        this.setZoom(this.zoom / 1.2, centerX, centerY);
    }
    
    resetZoom() {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.applyTransform();
        if (this.onZoomChange) {
            this.onZoomChange(this.zoom);
        }
    }
    
    startPanning(e) {
        this.isPanning = true;
        const coords = this.getScreenCoordinates(e);
        this.lastPanPoint = coords;
    }
    
    pan(e) {
        if (!this.isPanning) return;
        const coords = this.getScreenCoordinates(e);
        this.panX += coords.x - this.lastPanPoint.x;
        this.panY += coords.y - this.lastPanPoint.y;
        this.lastPanPoint = coords;
        this.applyTransform();
    }
    
    stopPanning() {
        this.isPanning = false;
    }
    
    getScreenCoordinates(e) {
        const container = this.canvas.parentElement;
        if (!container) return { x: 0, y: 0 };
        const rect = container.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    setupEventListeners() {
        // Prefer pointer events when available (unifies mouse/touch/pen)
        if (window.PointerEvent) {
            this.canvas.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                // Middle mouse button or space + click for panning
                if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
                    this.startPanning(e);
                } else {
                    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
                    this.startDrawing(e);
                }
            });
            this.canvas.addEventListener('pointermove', (e) => {
                if (this.isPanning) {
                    this.pan(e);
                } else {
                    this.draw(e);
                }
            });
            this.canvas.addEventListener('pointerup', (e) => {
                if (this.isPanning) {
                    this.stopPanning();
                } else {
                    this.stopDrawing();
                    try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) {}
                }
            });
            this.canvas.addEventListener('pointercancel', () => {
                this.stopDrawing();
                this.stopPanning();
            });
        } else {
            // Mouse events
            this.canvas.addEventListener('mousedown', (e) => {
                if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
                    this.startPanning(e);
                } else {
                    this.startDrawing(e);
                }
            });
            this.canvas.addEventListener('mousemove', (e) => {
                if (this.isPanning) {
                    this.pan(e);
                } else {
                    this.draw(e);
                }
            });
            this.canvas.addEventListener('mouseup', (e) => {
                if (this.isPanning) {
                    this.stopPanning();
                } else {
                    this.stopDrawing();
                }
            });
            this.canvas.addEventListener('mouseout', () => {
                this.stopDrawing();
                this.stopPanning();
            });
            
            // Touch events
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (e.touches.length === 2) {
                    // Two finger pan/zoom
                    this.startPanning(e.touches[0]);
                } else {
                    this.startDrawing(e.touches[0]);
                }
            }, { passive: false });
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (e.touches.length === 2 || this.isPanning) {
                    this.pan(e.touches[0]);
                } else {
                    this.draw(e.touches[0]);
                }
            }, { passive: false });
            this.canvas.addEventListener('touchend', () => {
                this.stopDrawing();
                this.stopPanning();
            });
        }
        
        // Mouse wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const container = this.canvas.parentElement;
                if (container) {
                    const rect = container.getBoundingClientRect();
                    const centerX = e.clientX - rect.left;
                    const centerY = e.clientY - rect.top;
                    if (e.deltaY < 0) {
                        this.zoomIn(centerX, centerY);
                    } else {
                        this.zoomOut(centerX, centerY);
                    }
                }
            }
        }, { passive: false });
    }
    
    getCoordinates(e) {
        // Convert screen coordinates to canvas coordinates
        const container = this.canvas.parentElement;
        if (!container) return { x: 0, y: 0 };
        const containerRect = container.getBoundingClientRect();
        const screenX = e.clientX - containerRect.left;
        const screenY = e.clientY - containerRect.top;
        
        // Convert to canvas coordinates accounting for zoom and pan
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        const canvasX = (screenX - centerX - this.panX) / this.zoom + this.canvasWidth / 2;
        const canvasY = (screenY - centerY - this.panY) / this.zoom + this.canvasHeight / 2;
        
        return {
            x: canvasX,
            y: canvasY
        };
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        const coords = this.getCoordinates(e);
        this.currentPath = [coords];
        
        // Initialize point buffer with first point
        this.pointBuffer = [coords];
        
        // Draw initial point
        this.drawPoint(coords);

        // Initialize last positions for segment streaming
        this.lastX = coords.x;
        this.lastY = coords.y;
        this.lastSentTime = 0;
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        const coords = this.getCoordinates(e);

        // Add point to buffer for smooth interpolation
        this.pointBuffer.push(coords);
        
        // Keep buffer size manageable (use last N points for smoothing)
        if (this.pointBuffer.length > this.maxBufferSize) {
            this.pointBuffer.shift();
        }

        // Draw locally immediately with smooth interpolation (client-side prediction)
        // Use the last few points for smooth Bezier curve rendering
        // Only draw the new segment to avoid overdrawing (use last 3 points for smooth connection)
        if (this.pointBuffer.length >= 2) {
            const pointsToDraw = this.pointBuffer.slice(-3); // Use last 3 points for smooth interpolation
            this.drawSmoothStroke(this.ctx, pointsToDraw, this.color, this.lineWidth, this.mode);
        }

        // Append to current path (for stroke completion)
        this.currentPath.push(coords);

        // Throttle segment emission (12ms = ~80 FPS for smoother network sync)
        const now = Date.now();
        if (this.onSegment && (now - this.lastSentTime >= this.minSegmentInterval)) {
            const timestamp = now;
            // Emit the last few points for smooth interpolation on remote clients
            const pointsToSend = this.pointBuffer.slice(-3); // Send last 3 points for smoothing
            if (pointsToSend.length >= 2) {
                this.onSegment({
                    points: pointsToSend,
                    color: this.color,
                    size: this.lineWidth,
                    tool: this.mode === 'eraser' ? 'eraser' : 'brush',
                    userId: window.currentSocketId,
                    timestamp: timestamp
                });
            }
            this.lastSentTime = now;
        }

        // Update last positions
        this.lastX = coords.x;
        this.lastY = coords.y;
    }
    
    // Draw smooth stroke using Bezier curve interpolation for continuous lines
    // This prevents gaps and broken lines during high-speed drawing
    drawSmoothStroke(ctx, points, color, size, mode) {
        if (!points || points.length < 2) return;
        
        ctx.save();
        
        // Set drawing style
        if (mode === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = color;
        }
        
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        // Use quadratic Bezier curves to smoothly connect points
        // This creates continuous, unbroken strokes even at high speed
        if (points.length === 2) {
            // Simple line for two points
            ctx.lineTo(points[1].x, points[1].y);
        } else {
            // Use quadratic curves for smooth interpolation
            for (let i = 1; i < points.length - 1; i++) {
                const current = points[i];
                const next = points[i + 1];
                const midX = (current.x + next.x) / 2;
                const midY = (current.y + next.y) / 2;
                // quadraticCurveTo(controlX, controlY, endX, endY)
                ctx.quadraticCurveTo(current.x, current.y, midX, midY);
            }
            // Connect to the last point
            const lastPoint = points[points.length - 1];
            ctx.lineTo(lastPoint.x, lastPoint.y);
        }
        
        ctx.stroke();
        ctx.restore();
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        // Send any remaining buffered points before completing stroke
        if (this.pointBuffer.length >= 2 && this.onSegment) {
            const now = Date.now();
            this.onSegment({
                points: this.pointBuffer,
                color: this.color,
                size: this.lineWidth,
                tool: this.mode === 'eraser' ? 'eraser' : 'brush',
                userId: window.currentSocketId,
                timestamp: now
            });
        }
        
        if (this.onStrokeComplete) {
            this.onStrokeComplete(this.currentPath);
        }
        this.currentPath = [];
        this.pointBuffer = []; // Clear buffer
    }

    // Draw segment (used for remote segments) - unified for brush and eraser
    // Uses layer system for conflict-free rendering with timestamp-based ordering
    // Supports both point-based (new) and segment-based (legacy) formats
    drawSegment(seg) {
        if (!seg) return;
        
        const userId = seg.userId || window.currentSocketId;
        const timestamp = seg.timestamp || Date.now();
        const isOwnSegment = userId === window.currentSocketId;

        // Skip if this is our own segment (already drawn locally via client prediction)
        if (isOwnSegment) {
            return;
        }

        // Get or create user layer
        const layerData = this.getUserLayer(userId);
        if (!layerData) return;

        // Timestamp-based ordering: ignore out-of-order packets
        if (layerData.lastTimestamp && timestamp < layerData.lastTimestamp) {
            // This packet is older than the last one we processed - skip it
            return;
        }
        layerData.lastTimestamp = timestamp;

        const { ctx: layerCtx } = layerData;
        
        // Update layer transform if needed (on zoom/pan changes)
        const container = this.canvas.parentElement;
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            
            layerCtx.setTransform(
                dpr * this.zoom, 0, 0, dpr * this.zoom,
                dpr * (centerX + this.panX - (this.canvasWidth / 2) * this.zoom),
                dpr * (centerY + this.panY - (this.canvasHeight / 2) * this.zoom)
            );
        }
        
        const color = seg.color || '#000000';
        const size = seg.size || this.lineWidth;
        const isEraser = seg.tool === 'eraser';
        
        // Support new point-based format for smooth interpolation
        if (seg.points && Array.isArray(seg.points) && seg.points.length >= 2) {
            // Use smooth stroke drawing with point interpolation
            this.drawSmoothStroke(layerCtx, seg.points, color, size, isEraser ? 'eraser' : 'brush');
        } else {
            // Legacy segment format (x0, y0, x1, y1) - convert to points for smoothing
            const from = { x: seg.x0 || 0, y: seg.y0 || 0 };
            const to = { x: seg.x1 || 0, y: seg.y1 || 0 };
            const points = [from, to];
            this.drawSmoothStroke(layerCtx, points, color, size, isEraser ? 'eraser' : 'brush');
        }
        
        // Update last update time for layer merging
        layerData.lastUpdate = Date.now();
        
        // For eraser operations, also apply to main canvas immediately
        // (since eraser needs to erase from merged content)
        if (isEraser) {
            const prevLineWidth = this.lineWidth;
            const prevColor = this.color;
            const prevMode = this.mode;

            this.lineWidth = size;
            this.color = color;
            this.mode = 'eraser';

            // Apply eraser to main canvas for immediate visual feedback
            // Use smooth stroke drawing
            if (seg.points && Array.isArray(seg.points) && seg.points.length >= 2) {
                this.drawSmoothStroke(this.ctx, seg.points, color, size, 'eraser');
            } else {
                const from = { x: seg.x0 || 0, y: seg.y0 || 0 };
                const to = { x: seg.x1 || 0, y: seg.y1 || 0 };
                this.drawSmoothStroke(this.ctx, [from, to], color, size, 'eraser');
            }

            // restore
            this.lineWidth = prevLineWidth;
            this.color = prevColor;
            this.mode = prevMode;
        }
        
        // Layer is already visible (separate canvas element positioned above main canvas)
        // Real-time compositing ensures smooth updates - no delay, instant rendering
    }

    // Enqueue a completed stroke (from other users) for ordered rendering
    enqueueStroke(stroke) {
        if (!stroke) return;
        this.incomingStrokes.push(stroke);
    }

    _processIncomingQueue() {
        try {
            if (this.incomingStrokes.length > 0) {
                // Sort by timestamp then layer to get deterministic order
                this.incomingStrokes.sort((a, b) => {
                    if ((a.timestamp || 0) !== (b.timestamp || 0)) return (a.timestamp || 0) - (b.timestamp || 0);
                    return (a.layer || 0) - (b.layer || 0);
                });

                // Process a small batch each frame to avoid blocking
                const batchSize = 5;
                const batch = this.incomingStrokes.splice(0, batchSize);
                batch.forEach(stroke => {
                    // Draw the completed stroke
                    this.drawStroke(stroke.points || [], stroke.color || '#000000', stroke.lineWidth || this.lineWidth, stroke.isEraser || false);
                });
            }
        } catch (err) {
            // swallow errors to keep loop alive
            console.error('Error processing incoming strokes:', err);
        } finally {
            requestAnimationFrame(this._processIncomingQueue);
        }
    }
    
    drawPoint(point) {
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, this.lineWidth / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.color;
        this.ctx.fill();
    }
    
    drawLine(from, to) {
        // Standard line drawing (used for remote segments and fallback)
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        
        if (this.mode === 'eraser') {
            // Eraser uses destination-out to actually remove pixels
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.strokeStyle = 'rgba(0,0,0,1)'; // Color doesn't matter for destination-out
        } else {
            // Brush uses source-over to draw normally
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.color;
        }
        
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    }
    
    drawStroke(points, color, lineWidth, isEraser = false) {
        if (points.length === 0) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        
        if (isEraser) {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = color;
        }
        
        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    }
    
    clear() {
        // Clear the entire canvas area
        const container = this.canvas.parentElement;
        if (container) {
            this.ctx.save();
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
            this.applyTransform();
            // Fill with background color
            const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#ffffff';
            this.ctx.fillStyle = bgColor;
            this.ctx.fillRect(-this.canvasWidth / 2, -this.canvasHeight / 2, this.canvasWidth, this.canvasHeight);
        }
    }
    
    setColor(color) {
        this.color = color;
    }
    
    setLineWidth(width) {
        this.lineWidth = width;
    }
    
    setMode(mode) {
        this.mode = mode;
        if (mode === 'eraser') {
            this.canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'10\' fill=\'none\' stroke=\'%23000\' stroke-width=\'2\'/%3E%3Cpath d=\'M8 8 L16 16 M16 8 L8 16\' stroke=\'%23000\' stroke-width=\'2\'/%3E%3C/svg%3E") 12 12, auto';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }
    
    // Export canvas as PNG
    exportAsPNG() {
        // Create a temporary canvas with the full canvas size
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvasWidth;
        tempCanvas.height = this.canvasHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Fill with white background
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Redraw all strokes on the temp canvas
        // Note: This requires access to the stroke history, which we'll need to track
        // For now, we'll export the visible canvas area
        const link = document.createElement('a');
        link.download = 'canvas-export.png';
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }
    
    redraw(strokes) {
        // Clear and redraw all strokes
        const container = this.canvas.parentElement;
        if (container) {
            this.ctx.save();
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
            this.applyTransform();
            // Fill with background color
            const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#ffffff';
            this.ctx.fillStyle = bgColor;
            this.ctx.fillRect(-this.canvasWidth / 2, -this.canvasHeight / 2, this.canvasWidth, this.canvasHeight);
            // Redraw all strokes
            strokes.forEach(stroke => {
                this.drawStroke(stroke.points, stroke.color, stroke.lineWidth, stroke.isEraser || false);
            });
        }
    }
    
    updateCursorIndicator(userId, x, y, userName, userColor) {
        let indicator = this.cursorIndicators.get(userId);
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'cursor-indicator';
            indicator.id = `cursor-${userId}`;
            indicator.style.position = 'absolute';
            indicator.style.pointerEvents = 'none';
            indicator.style.zIndex = '1000';
            indicator.style.transform = 'translate(-50%, -50%)';
            indicator.style.transition = 'opacity 0.2s ease';
            
            // Create outer ring for better visibility
            const outerRing = document.createElement('div');
            outerRing.className = 'cursor-outer-ring';
            outerRing.style.width = '24px';
            outerRing.style.height = '24px';
            outerRing.style.borderRadius = '50%';
            outerRing.style.position = 'absolute';
            outerRing.style.top = '50%';
            outerRing.style.left = '50%';
            outerRing.style.transform = 'translate(-50%, -50%)';
            outerRing.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            outerRing.style.border = '2px solid';
            indicator.appendChild(outerRing);
            
            // Create colored dot (main cursor indicator)
            const dot = document.createElement('div');
            dot.className = 'cursor-dot';
            dot.style.width = '16px';
            dot.style.height = '16px';
            dot.style.borderRadius = '50%';
            dot.style.position = 'absolute';
            dot.style.top = '50%';
            dot.style.left = '50%';
            dot.style.transform = 'translate(-50%, -50%)';
            dot.style.border = '2px solid';
            dot.style.backgroundColor = 'white';
            dot.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
            indicator.appendChild(dot);
            
            // Create label with username
            const label = document.createElement('div');
            label.className = 'cursor-label';
            label.style.position = 'absolute';
            label.style.top = '-30px';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.color = 'white';
            label.style.padding = '4px 8px';
            label.style.borderRadius = '4px';
            label.style.fontSize = '11px';
            label.style.fontWeight = '600';
            label.style.whiteSpace = 'nowrap';
            label.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.3)';
            label.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
            label.textContent = userName || userId;
            indicator.appendChild(label);
            
            // Use the assigned color from server
            const color = userColor || '#000000';
            outerRing.style.borderColor = color;
            dot.style.borderColor = color;
            // Keep dot background white for visibility, border is colored
            label.style.background = color;
            
            // Add to canvas wrapper (parent of canvas)
            const container = this.canvas.parentElement;
            if (container) {
                container.appendChild(indicator);
            }
            this.cursorIndicators.set(userId, indicator);
        } else {
            // Update color if it changed
            if (userColor) {
                const color = userColor;
                const outerRing = indicator.querySelector('.cursor-outer-ring');
                if (outerRing) {
                    outerRing.style.borderColor = color;
                }
                const dot = indicator.querySelector('.cursor-dot');
                if (dot) {
                    dot.style.borderColor = color;
                    // Keep dot background white for visibility
                }
                const label = indicator.querySelector('.cursor-label');
                if (label) {
                    label.style.background = color;
                }
            }
            // Update name if provided
            if (userName) {
                const label = indicator.querySelector('.cursor-label');
                if (label) {
                    label.textContent = userName;
                }
            }
        }
        
        // Position relative to canvas within its wrapper
        const container = this.canvas.parentElement;
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            // Calculate position relative to container
            const relativeX = x + (canvasRect.left - containerRect.left);
            const relativeY = y + (canvasRect.top - containerRect.top);
            
            indicator.style.left = relativeX + 'px';
            indicator.style.top = relativeY + 'px';
            indicator.style.display = 'block';
            indicator.style.opacity = '1';
        }
        
        // Hide cursor after 3 seconds of no movement (increased from 2s)
        clearTimeout(indicator.hideTimeout);
        indicator.hideTimeout = setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.style.opacity === '0') {
                    indicator.style.display = 'none';
                }
            }, 200);
        }, 3000);
    }
    
    removeCursorIndicator(userId) {
        const indicator = this.cursorIndicators.get(userId);
        if (indicator) {
            indicator.remove();
            this.cursorIndicators.delete(userId);
        }
        // Also clear user layer when user leaves
        this.clearUserLayer(userId);
    }
}

