/*******************************************************************************
 * Capture the current replay canvas inside the configured video crop zone.
 * Replay snapshots intentionally capture Cesium only and never wait for widgets.
 ******************************************************************************/

import { VIDEO_CROP_ZONE } from '@Core/constants'
import { buildReplayVideoComposerOverlays } from '@Core/ui/replay/ReplayVideoOverlayComposer'
import { CanvasOverlayComposer } from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import { UIToast }       from '@Utils/UIToast'

const positiveNumber = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

const readCrop = () => {
    const configured = globalThis.__?.ui?.widgetManager?.getWidgetConfig?.(VIDEO_CROP_ZONE)?.cropDimensions
    const crop = configured ?? globalThis.lgs?.stores?.replay?.videoCropRect
    if (!crop) {
        return null
    }
    const left = Number(crop.left)
    const top = Number(crop.top)
    const width = positiveNumber(crop.width)
    const height = positiveNumber(crop.height)
    return Number.isFinite(left) && Number.isFinite(top) && width && height
           ? {left, top, width, height}
           : null
}

const toBlob = canvas => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Replay snapshot generation failed.')), 'image/png')
})

const download = (blob, filename) => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
}

const filenamePart = value => String(value ?? 'replay').trim().replace(/[^\w.-]+/g, '-') || 'replay'

export const captureReplayCropSnapshot = async () => {
    const source = globalThis.lgs?.canvas
    const crop = readCrop()
    const rect = source?.getBoundingClientRect?.()

    if (!(source instanceof HTMLCanvasElement) || !crop || !rect?.width || !rect?.height) {
        UIToast.error({text: 'Replay snapshot is unavailable without a crop zone.'})
        return false
    }

    let composer = null
    try {
        composer = new CanvasOverlayComposer(source, {
            clip:             {x: crop.left, y: crop.top, width: crop.width, height: crop.height},
            width:            crop.width,
            height:           crop.height,
            flushWebGLBuffer: () => globalThis.lgs?.scene?.render?.(),
        })
        // Widgets are composed from their already-mounted canvases. The
        // snapshot remains one-shot: no mount wait or video toolbar state.
        buildReplayVideoComposerOverlays({
            composer,
            cropRect: crop,
        })
        await composer.renderFrame()
        const blob = await toBlob(composer.getCanvas())
        const filename = `${filenamePart(globalThis.lgs?.theJourney?.title)}-replay-snapshot.png`
        download(blob, filename)
        UIToast.success({caption: 'Export success', text: `Exported to ${filename}`})
        return true
    }
    catch (error) {
        UIToast.error({text: error?.message ?? 'Replay snapshot generation failed.'})
        return false
    }
    finally {
        composer?.dispose()
    }
}
