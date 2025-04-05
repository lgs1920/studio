export class InteractionHandler {
    constructor(toolbar) {
        this.toolbar = toolbar; // Référence à l'élément
        this.dragging = false;
        this.offsetX = 0;
        this.offsetY = 0;
        this.animationFrame = null;

        // Liaison des méthodes pour s'assurer qu'elles conservent le bon contexte
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);

        // Ajout des événements
        document.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('touchstart', this.handleTouchStart);
    }

    handleMove(event) {
        if (this.dragging) {
            const clientX = event.touches ? event.touches[0].clientX : event.clientX;
            const clientY = event.touches ? event.touches[0].clientY : event.clientY;

            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
            }

            this.animationFrame = requestAnimationFrame(() => {
                this.toolbar.y = clientY - this.offsetY;
                this.toolbar.x = clientX - this.offsetX;
            });
        }
    }

    handleEnd() {
        document.removeEventListener('mousemove', this.handleMove);
        document.removeEventListener('mouseup', this.handleEnd);
        document.removeEventListener('touchmove', this.handleMove);
        document.removeEventListener('touchend', this.handleEnd);

        this.toolbar.classList.remove('dragging');
        document.body.classList.remove('no-select');

        this.dragging = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    handleMouseDown(event) {
        this.initializeDragging(event.clientX, event.clientY);

        document.addEventListener('mousemove', this.handleMove);
        document.addEventListener('mouseup', this.handleEnd);
    }

    handleTouchStart(event) {
        const touch = event.touches[0];
        this.initializeDragging(touch.clientX, touch.clientY);

        document.addEventListener('touchmove', this.handleMove);
        document.addEventListener('touchend', this.handleEnd);
    }

    initializeDragging(clientX, clientY) {
        const boundingBox = this.toolbar.getBoundingClientRect();

        this.offsetX = clientX - boundingBox.left;
        this.offsetY = clientY - boundingBox.top;

        this.toolbar.classList.add('dragging');
        document.body.classList.add('no-select');
        this.dragging = true;
    }
}
