import { BOTTOM, END, MOBILE_MAX, START } from '@Core/constants'

export class MenuManager {

    constructor() {
        // Singleton
        if (MenuManager.instance) {
            return MenuManager.instance
        }

        this.reset()
        MenuManager.instance = this

    }

    reset = () => {
        if (window.innerWidth <= MOBILE_MAX) {
            lgs.editorSettingsProxy.menu.drawer = lgs.settings.ui.menu.drawers.fromBottom ? BOTTOM : TOP
        }
        else {
            lgs.editorSettingsProxy.menu.drawer = lgs.settings.ui.menu.drawers.fromStart ? START : END
        }
    }
}