export class LayerManager {

    static IGN_CADASTRAL = 'ign-cadastral'
    static IGN_PLAN = 'ign-plan'
    static IGN_AERIAL = 'ign-photo'
    static OSM_PLAN = 'osm-plan'

    /**
     * current layer
     * @type {null|string}
     */
    #layer = null
    /**
     * Current overlay layer
     */
    #overlay = null
    /**
     * current provider
     * @type {null|string}
     */
    #provider = null
    /**
     * All providers
     * @type {Map<any, any>}
     */
    #providers = new Map()
    /**
     * All layers
     */
    #layers = new Map()

    constructor() {

        // Singleton
        if (LayerManager.instance) {
            return LayerManager.instance
        }

        this.#layer = lgs.configuration.layers.current
        this.#overlay = lgs.configuration.layers.overlay
        this.#provider = this.#layer.split('-')[0]

        // Let's transform layers and provider in order to be more efficient in code
        lgs.configuration.layers.providers.forEach(provider => {
            provider.layers.forEach(layer => {
                layer.provider = provider.id
                this.#layers.set(layer.id, layer)
            })
            this.#providers.set(provider.id, provider)

        })

        LayerManager.instance = this

    }

    get layer() {
        return this.#layers.get(this.#layer)
    }

    get overlay() {
        return this.#layers.get(this.#overlay)
    }

    set layer(layer) {
        this.#layer = layer
    }

    get layers() {
        return this.#layers
    }

    get provider() {
        return this.#providers.get(this.#provider)
    }

    get providers() {
        return this.#providers
    }

}


