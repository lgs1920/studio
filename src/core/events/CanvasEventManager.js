import { ScreenSpaceEventHandler } from 'cesium'

export class CanvasEventManager {
    constructor(viewer = lgs.viewer) {

        // Singleton
        if (CanvasEventManager.instance) {
            return CanvasEventManager.instance
        }

        this.viewer = viewer
        this.handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
        this.eventHandlers = new Map()

        CanvasEventManager.instance = this

    }

    addEventListener(eventType, callback) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, [])
        }

        const callbacks = this.eventHandlers.get(eventType)
        if (!callbacks.includes(callback)) {
            callbacks.push(callback)
            this.handler.setInputAction((event) => {
                callbacks.forEach((cb) => cb(event)) // Exécuter tous les callbacks attachés
            }, eventType)
        }
    }

    removeEventListener(eventType, callback) {
        const callbacks = this.eventHandlers.get(eventType)
        if (callbacks) {
            const index = callbacks.indexOf(callback)
            if (index > -1) {
                callbacks.splice(index, 1)
                console.log(`Callback détaché pour l'événement "${eventType}".`)
            }

            if (callbacks.length === 0) {
                this.handler.removeInputAction(eventType) // Supprime l'événement s'il n'y a plus de callbacks
                this.eventHandlers.delete(eventType)
            }
        }
    }

    removeAllEventListeners(eventType) {
        if (this.eventHandlers.has(eventType)) {
            this.handler.removeInputAction(eventType)
            this.eventHandlers.delete(eventType)
            console.log(`Tous les callbacks détachés pour l'événement "${eventType}".`)
        }
    }
}
