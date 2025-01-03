export class MenuManager {

    /** @param instance {MenuManager} */
    instance

    constructor() {
        // Singleton
        if (MenuManager.instance) {
            return MenuManager.instance
        }
        MenuManager.instance = this

    }
}