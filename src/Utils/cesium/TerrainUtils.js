import { TERRAIN_FROM_CESIUM, TERRAIN_FROM_CESIUM_ELLIPSOID, TERRAIN_FROM_URL, URL_AUTHENT_KEY } from '@Core/constants'
import { CesiumTerrainProvider, EllipsoidTerrainProvider, IonResource, Terrain }                  from 'cesium'

export class TerrainUtils {

    /**
     * Sett  terrain from settings
     *
     * @param entity {string|object} Entity Id or Entity Object
     * @return {Promise<CesiumTerrainProvider>|null}
     */
    static setTerrain(entity) {
        // we assume that if it not a string,it is the entity object
        const theEntity = (typeof entity === 'string') ? __.layersAndTerrainManager.getEntityProxy(entity) : entity

        // Set the right terrain

        // We know the URL
        if (theEntity?.url && theEntity.terrainType === TERRAIN_FROM_URL) {
            let theURL = theEntity.url
            if (theURL.includes(URL_AUTHENT_KEY)) {
                if (theEntity.usage?.unlocked && theEntity.usage?.name) {
                    theURL = theURL.replace(URL_AUTHENT_KEY, `${theEntity.usage.name}=${theEntity.usage.token}`)
                }
                else {
                    theURL = theURL.replace(URL_AUTHENT_KEY, '')
                }
            }

            return CesiumTerrainProvider.fromUrl(theURL, {requestVertexNormals: false})
        }

        if (theEntity.terrainType === TERRAIN_FROM_CESIUM) {
            return CesiumTerrainProvider.fromUrl(IonResource.fromAssetId(1), {
                requestVertexNormals: false,
            })
        }

        if (theEntity.terrainType === TERRAIN_FROM_CESIUM_ELLIPSOID) {
            return new EllipsoidTerrainProvider({
                                                    requestVertexNormals: false,
                                                })
        }

        return null
    }

    static async changeTerrain(entity) {
        const terrain = new Terrain(await TerrainUtils.setTerrain(entity))
        if (terrain) {
            await lgs.scene.setTerrain(terrain)
        }
    }
}