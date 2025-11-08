// WebSocket communication using Socket.io
export class WebSocketManager {
    constructor() {
        this.socket = null;
        this.userId = this.generateUserId();
        this.onDrawingReceived = null;
    this.onDrawingSegmentReceived = null;
        this.onStateReceived = null;
        this.onUserJoined = null;
        this.onUserLeft = null;
        this.onCursorMove = null;
        this.onUndoReceived = null;
        this.onRedoReceived = null;
        this.onClearReceived = null;
        this.onUsersListReceived = null;
        this.onUndoFailed = null;
        this.onRedoFailed = null;
        this.onUserColorReceived = null;
        this.onConnect = null;
        this.onDisconnect = null;
        this.onConnectError = null;
        this.onReconnecting = null;
        this.userColor = null; // Store the user's assigned color
        this.onLatencyUpdated = null; // callback for latency (ms)
    }
    
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }
    
    connect(roomId = null, userName = null) {
        // Pass roomId and userName as query params so server can assign to a room
        const connectOpts = {};
        const query = {};
        if (roomId) query.roomId = roomId;
        if (userName) query.userName = userName;
        if (Object.keys(query).length > 0) connectOpts.query = query;

        this.socket = io(connectOpts);
        
        this.socket.on('connect', () => {
            // Use server-assigned socket id as the canonical user id
            try {
                this.userId = this.socket.id;
                // Expose for templates/other code that may expect a global
                window.currentSocketId = this.socket.id;
            } catch (err) {}

            console.log('Connected to server, socket id =', this.socket.id);
            if (this.onConnect) {
                this.onConnect();
            }
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            if (this.onDisconnect) {
                this.onDisconnect();
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            if (this.onConnectError) {
                this.onConnectError(error);
            }
        });
        
        this.socket.on('reconnect_attempt', () => {
            console.log('Attempting to reconnect...');
            if (this.onReconnecting) {
                this.onReconnecting();
            }
        });
        
        this.socket.on('reconnect', () => {
            console.log('Reconnected to server');
            if (this.onConnect) {
                this.onConnect();
            }
        });
        
        this.socket.on('reconnect_failed', () => {
            console.error('Reconnection failed');
            if (this.onConnectError) {
                this.onConnectError();
            }
        });
        
        this.socket.on('drawing', (data) => {
            if (this.onDrawingReceived) {
                this.onDrawingReceived(data);
            }
        });

        // Incoming live drawing segments from other users
        this.socket.on('drawingSegment', (data) => {
            if (this.onDrawingSegmentReceived) {
                this.onDrawingSegmentReceived(data);
            }
        });
        
        this.socket.on('state', (data) => {
            if (this.onStateReceived) {
                this.onStateReceived(data);
            }
        });
        
        this.socket.on('userJoined', (data) => {
            if (this.onUserJoined) {
                this.onUserJoined(data);
            }
        });
        
        this.socket.on('userLeft', (data) => {
            if (this.onUserLeft) {
                this.onUserLeft(data);
            }
        });
        
        this.socket.on('cursorMove', (data) => {
            if (this.onCursorMove) {
                this.onCursorMove(data);
            }
        });
        
        this.socket.on('undo', (data) => {
            if (this.onUndoReceived) {
                this.onUndoReceived(data);
            }
        });
        
        this.socket.on('redo', (data) => {
            if (this.onRedoReceived) {
                this.onRedoReceived(data);
            }
        });
        
        this.socket.on('clear', (data) => {
            if (this.onClearReceived) {
                this.onClearReceived(data);
            }
        });
        
        this.socket.on('usersList', (users) => {
            if (this.onUsersListReceived) {
                this.onUsersListReceived(users);
            }
        });
        
        this.socket.on('undoFailed', (data) => {
            if (this.onUndoFailed) {
                this.onUndoFailed(data);
            }
        });
        
        this.socket.on('redoFailed', (data) => {
            if (this.onRedoFailed) {
                this.onRedoFailed(data);
            }
        });
        
        this.socket.on('userColor', (data) => {
            this.userColor = data.color;
            if (this.onUserColorReceived) {
                this.onUserColorReceived(data);
            }
        });

        // Handle pong reply from server for latency measurement
        this.socket.on('pongTime', (data) => {
            try {
                const now = Date.now();
                const sent = data && data.ts ? data.ts : now;
                const rtt = now - sent;
                if (this.onLatencyUpdated) this.onLatencyUpdated(rtt);
            } catch (err) {
                // ignore
            }
        });
    }
    
    getUserColor() {
        return this.userColor;
    }
    
    sendDrawing(points, color, lineWidth, isEraser = false) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('drawing', {
                userId: this.userId,
                color: color,
                lineWidth: lineWidth,
                points: points,
                isEraser: isEraser,
                timestamp: Date.now()
            });
        }
    }

    // Send a small live drawing segment while the user is drawing
    // Supports both point-based (new) and segment-based (legacy) formats
    sendSegment(x0, y0, x1, y1, color, size, tool = 'brush', points = null) {
        if (this.socket && this.socket.connected) {
            const data = {
                userId: this.userId,
                color, size, tool,
                timestamp: Date.now()
            };
            
            // If points array is provided, use new point-based format for smooth interpolation
            if (points && Array.isArray(points) && points.length >= 2) {
                data.points = points;
            } else {
                // Legacy segment format for backward compatibility
                data.x0 = x0;
                data.y0 = y0;
                data.x1 = x1;
                data.y1 = y1;
            }
            
            this.socket.emit('drawingSegment', data);
        }
    }
    
    sendCursorMove(x, y) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('cursorMove', {
                userId: this.userId,
                x: x,
                y: y
            });
        }
    }
    
    sendUndo() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('undo', {
                userId: this.userId
            });
        }
    }
    
    sendRedo() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('redo', {
                userId: this.userId
            });
        }
    }
    
    sendClear() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('clear', {
                userId: this.userId
            });
        }
    }

    // Send a ping with timestamp; server will echo back to help measure latency
    sendPing() {
        if (this.socket && this.socket.connected) {
            const ts = Date.now();
            this.socket.emit('pingTime', { ts });
            return ts;
        }
        return null;
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
    
    getUserId() {
        return this.userId;
    }
}

