import { END, START } from '@Core/constants'

export class MenuManager {

    /** @param instance {MenuManager} */
    instance

    constructor() {
        // Singleton
        if (MenuManager.instance) {
            return MenuManager.instance
        }

        lgs.editorSettingsProxy.menu.drawer = lgs.settings.ui.menu.drawers.fromStart ? START : END
        lgs.editorSettingsProxy.menu.toolbar = lgs.settings.ui.menu.toolBar.fromStart ? START : END

        MenuManager.instance = this

    }
}