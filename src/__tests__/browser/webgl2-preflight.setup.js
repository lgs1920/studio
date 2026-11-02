/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: webgl2-preflight.setup.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-02
 * Last modified: 2026-11-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const probeCanvas = document.createElement('canvas')
const webgl2 = probeCanvas.getContext('webgl2')

if (!webgl2) {
    throw new Error('The actual browser runner must support WebGL 2')
}

webgl2.clearColor(0.25, 0.5, 0.75, 1)
webgl2.clear(webgl2.COLOR_BUFFER_BIT)
const pixel = new Uint8Array(4)
webgl2.readPixels(0, 0, 1, 1, webgl2.RGBA, webgl2.UNSIGNED_BYTE, pixel)
const expectedPixel = [64, 128, 191, 255]

if (pixel.some((channel, index) => channel !== expectedPixel[index])) {
    throw new Error(`WebGL 2 pixel readback mismatch: ${Array.from(pixel).join(', ')}`)
}

webgl2.getExtension('WEBGL_lose_context')?.loseContext()
