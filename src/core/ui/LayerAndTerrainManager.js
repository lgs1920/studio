import { TerrainUtils } from '@Utils/cesium/TerrainUtils'

export class LayersAndTerrainManager {

    /**
     * current layer
     * @type {null|string}
     */
    #base = null
    /**
     * Current overlay layer
     */
    #overlay = null
    /** current terrain **/
    #terrain = null
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
    #bases = new Map()

    constructor() {

        // Singleton
        if (LayersAndTerrainManager.instance) {
            return LayersAndTerrainManager.instance
        }

        this.#base = lgs.settings.getLayers.base
        this.#overlay = lgs.settings.getLayers.overlay
        this.#provider = this.#base.split('-')[0]

        // Let's transform layers and provider in order to be more efficient in code
        lgs.settings.layers.providers.forEach(provider => {
            provider.layers.forEach(layer => {
                layer.provider = provider.id
                this.#bases.set(layer.id, layer)
            })
            this.#providers.set(provider.id, provider)

        })

        LayersAndTerrainManager.instance = this

    }

    get layer() {
        return this.#bases.get(this.#base)
    }

    set layer(layer) {
        this.#base = layer
    }

    get overlay() {
        return this.#bases.get(this.#overlay)
    }

    get layers() {
        return this.#bases
    }

    getALayer = (layer = this.#base) => {
        return this.#bases.get(layer)
    }

    get provider() {
        return this.#providers.get(this.#provider)
    }

    get providers() {
        return this.#providers
    }

    getProviderByEntity = (entityId) => {
        if (entityId === null) {
            return null
        }
        return entityId?.split('-')[0] ?? null
    }

    /** @deprecated **/
    getProviderIdByLayerId = this.getProviderByEntity
    
    getProviderProxy = (providerId) => {
        if (providerId === null) {
            return null
        }
        return lgs.settings.layers.providers.find(provider => provider.id === providerId)

    }
    getProviderProxyByEntity = (entityId) => {
        if (entityId === null) {
            return null
        }
        const providerId = this.getProviderByEntity(entityId)
        return lgs.settings.layers.providers.find(provider => provider.id === providerId)
    }

    getEntityProxy = (entityId) => {
        const provider = this.getProviderProxy(this.getProviderByEntity(entityId))
        return provider.layers.find(layer => layer.id === entityId)
    }

    changeTerrain = (entity) => {
        TerrainUtils.changeTerrain(entity)
    }

}