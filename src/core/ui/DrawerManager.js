export class DrawerManager {

    /** @param state {null|string} */
    drawers = null

    constructor() {
        // Singleton
        if (DrawerManager.instance) {
            return DrawerManager.instance
        }

        this.drawers = lgs.mainProxy.drawers
        DrawerManager.instance = this
    }

    isCurrent = (id) => {
        return this.drawers.open === id
    }

    /**
     *
     * @param id {string}
     * @return {boolean}
     */
    canOpen = (id) => {
        return !this.isCurrent(id)
    }

    /**
     * Toggle drawer state
     * @param id {string}
     */
    toggle = (id) => {
        if (this.canOpen(id)) {
            this.open(id)
        }
        else {
            this.close()
        }
    }

    /**
     * Mark drawer state as open
     * @param id
     */
    open = (id) => {
        this.drawers.open = id
    }

    /**
     * Mark drawer state as closed
     */
    close = () => {
        document.activeElement?.blur() // Remove focus on children
        this.drawers.open = null
    }


    check = (event) => {
        if (event.target.nodeName !== 'SL-DRAWER') {
            event.preventDefault()
            return false
        }
        return true
    }

}