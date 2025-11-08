// Off-screen buffer canvas management
export class BufferCanvas {
    constructor(width, height) {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize(width, height);
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Copy buffer content to the main canvas
    blitTo(targetCtx) {
        targetCtx.drawImage(this.canvas, 0, 0);
    }

    // Get context for direct drawing
    getContext() {
        return this.ctx;
    }
}