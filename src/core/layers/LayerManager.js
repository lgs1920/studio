export class LayerManager {

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

        this.#layer = lgs.settings.getLayers.base
        this.#overlay = lgs.settings.getLayers.overlay
        this.#provider = this.#layer.split('-')[0]

        // Let's transform layers and provider in order to be more efficient in code
        lgs.settings.layers.providers.forEach(provider => {
            provider.layers.forEach(layer => {
                layer.provider = provider.id
                this.#layers.set(layer.id, layer)
            })
            this.#providers.set(provider.id, provider)

        })

        LayerManager.instance = this

    }

    getALayer = (layer = this.#layer) => {
        return this.#layers.get(layer)
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

    getProviderIdByLayerId = (layerId) => {
        return layerId?.split('-')[0] ?? null
    }
    getProviderProxy = (providerId) => {
        return lgs.settings.layers.providers.find(provider => provider.id === providerId)

    }
    getProviderProxyByLayerId = (layerId) => {
        const providerId = this.getProviderIdByLayerId(layerId)
        return lgs.settings.layers.providers.find(provider => provider.id === providerId)
    }

    getLayerProxy = (layerId) => {
        const provider = this.getProviderProxy(this.getProviderIdByLayerId(layerId))
        return provider.layers.find(layer => layer.id === layerId)
    }

}


