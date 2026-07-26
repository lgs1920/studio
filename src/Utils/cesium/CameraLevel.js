import { Ellipsoid } from 'cesium'
import { cameraHeightToSlippyLevel } from './Tiles3DErrorLabels'

const FULL_WORLD_RADIANS = Math.PI * 2
const DEFAULT_TILE_WIDTH = 256
const DEFAULT_LEVEL_ZERO_X_TILES = 1

const finitePositiveNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : null
}

const viewportWidthOf = scene => finitePositiveNumber(
    scene?.drawingBufferWidth
    ?? scene?.canvas?.clientWidth
    ?? scene?.canvas?.width,
)

const imageryResolutionOf = imageryProvider => ({
    tileWidth: finitePositiveNumber(imageryProvider?.tileWidth) ?? DEFAULT_TILE_WIDTH,
    levelZeroXTiles: finitePositiveNumber(
        imageryProvider?.tilingScheme?.getNumberOfXTilesAtLevel?.(0),
    ) ?? DEFAULT_LEVEL_ZERO_X_TILES,
})

/**
 * Returns the slippy-map level that best matches the horizontal extent
 * currently visible in the Cesium viewport.
 */
export const cameraViewToSlippyLevel = (camera, scene, {
    imageryProvider,
    fallbackHeight,
} = {}) => {
    const fallbackLevel = cameraHeightToSlippyLevel(fallbackHeight ?? camera?.positionCartographic?.height)
    const viewportWidth = viewportWidthOf(scene)
    if (!camera?.computeViewRectangle || !viewportWidth) {
        return fallbackLevel
    }

    let viewRectangle
    try {
        viewRectangle = camera.computeViewRectangle(Ellipsoid.WGS84)
    }
    catch {
        return fallbackLevel
    }

    const viewWidth = finitePositiveNumber(viewRectangle?.width)
    if (!viewWidth || viewWidth >= FULL_WORLD_RADIANS) {
        return fallbackLevel
    }

    const {tileWidth, levelZeroXTiles} = imageryResolutionOf(imageryProvider)
    const visibleWorldFraction = viewWidth / FULL_WORLD_RADIANS
    const level = Math.floor(Math.log2(
        viewportWidth / (tileWidth * levelZeroXTiles * visibleWorldFraction),
    ))

    return Number.isFinite(level) ? Math.max(0, level) : fallbackLevel
}
