// Drawing state management
// Implements global undo/redo system - any user can undo/redo any stroke
export class DrawingState {
    constructor(initialStrokes = []) {
        // Allow initializing from persisted state
        this.strokes = Array.isArray(initialStrokes) ? initialStrokes.slice() : [];
        this.undoStack = []; // Stack of undone strokes for redo functionality
    }
    
    addStroke(stroke) {
        // Add stroke to the end of the strokes array
        this.strokes.push(stroke);
        // Clear redo stack when new stroke is added (can't redo after new action)
        this.undoStack = [];
        return stroke.id;
    }
    
    // Global undo: removes the latest stroke regardless of who drew it
    undoLastStroke() {
        if (this.strokes.length === 0) return null;
        
        // Remove the last stroke (most recent) and add to undo stack
        const removedStroke = this.strokes.pop();
        this.undoStack.push(removedStroke);
        return removedStroke;
    }
    
    // Global redo: restores the most recently undone stroke
    redoLastStroke() {
        if (this.undoStack.length === 0) return null;
        
        // Restore the most recently undone stroke
        const restoredStroke = this.undoStack.pop();
        this.strokes.push(restoredStroke);
        return restoredStroke;
    }
    
    getState() {
        return this.strokes;
    }
    
    clear() {
        this.strokes = [];
        this.undoStack = [];
    }
    
    getStrokeCount() {
        return this.strokes.length;
    }

    // Serialize state for disk persistence
    toJSON() {
        return {
            strokes: this.strokes
        };
    }

    // Create a DrawingState from JSON loaded from disk
    static fromJSON(obj) {
        if (!obj || !Array.isArray(obj.strokes)) return new DrawingState();
        return new DrawingState(obj.strokes);
    }
}

