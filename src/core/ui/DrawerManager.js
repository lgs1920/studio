/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DrawerManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-23
 * Last modified: 2025-02-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

export class DrawerManager {

    /** @param state {null|string} */
    drawers = null
    /** @param {boolean} */
    over = false

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
    open = (id, action) => {
        this.drawers.open = id
        this.drawers.action = action
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

    mouseLeave = (event) => {
        this.over = false
    }

    mouseEnter = (event) => {
        this.over = true
    }

    attachEvents = () => {
        // We detect if we're over a drawer or not
        document.querySelectorAll('sl-drawer').forEach(drawer => {
            drawer.addEventListener('mouseleave', this.mouseLeave)
            drawer.addEventListener('mouseenter', this.mouseEnter)
        })
    }

    clean = () => {
        this.drawers.action = null
    }

}