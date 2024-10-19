export class LayerManager {

    static IGN_CADASTRAL = 'ign-cadastral'
    static IGN_PLAN = 'ign-plan'
    static IGN_AERIAL = 'ign-photo'
    static OSM_PLAN = 'osm-plan'

    #current = null

    constructor() {

        // Singleton
        if (LayerManager.instance) {
            return LayerManager.instance
        }

        this.#current = lgs.settings.layers.current
        console.log('layer', lgs.settings.layers)

        LayerManager.instance = this

    }

    get current() {
        return this.#current
    }

    set current(current) {
        this.#current = current
    }

}


