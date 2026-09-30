/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayMediaCapture.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-30
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {APP_KEY} from '@Core/constants'
import {DateTime} from 'luxon'

/** Screenshot capture and media handoff used by Replay exports. */
export class ReplayMediaCapture extends EventTarget {
    static events = {
        CAPTURED: 'video/captured',
    }

    static instance
    static VIDEO = 'video'
    static IMAGE = 'image'

    #blob = null
    #type = null
    #metadata = null
    #ratio = null
    #dimensions = {width: 0, height: 0}

    constructor() {
        super()
        if (ReplayMediaCapture.instance) {
            return ReplayMediaCapture.instance
        }
        ReplayMediaCapture.instance = this
        globalThis.__.mediaCapture = this
    }

    get mediaData() {
        return {
            blob: this.#blob,
            size: this.#blob?.size ?? 0,
            duration: 0,
            dimensions: this.#dimensions,
            ratio: this.#ratio,
            metadata: this.#metadata,
            mimeType: this.#blob?.type ?? 'image/png',
            extension: 'png',
        }
    }

    get type() {
        return this.#type
    }

    set type(type) {
        this.#type = type
    }

    isImage = () => this.#type === ReplayMediaCapture.IMAGE
    isVideo = () => this.#type === ReplayMediaCapture.VIDEO

    filename = () => `${DateTime.now().toFormat('yyyyLLdHHmm')}-${APP_KEY}`

    captureScreenshot = async (canvas, {ratio = null, metadata = null} = {}) => {
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new TypeError('Screenshot capture requires a canvas.')
        }
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(value => value ? resolve(value) : reject(new Error('Screenshot encoding failed.')), 'image/png')
        })
        this.#blob = blob
        this.#type = ReplayMediaCapture.IMAGE
        this.#metadata = metadata
        this.#ratio = ratio ? lgs.configuration.videoFormats.find(format => format.value === ratio) ?? ratio : null
        this.#dimensions = {width: canvas.width, height: canvas.height}
        this.dispatchEvent(new CustomEvent(ReplayMediaCapture.events.CAPTURED, {
            detail: {canvas, blob, ...this.mediaData},
        }))
    }

    url = async () => {
        if (!this.#blob) {
            throw new Error('No captured media is available.')
        }
        return {url: URL.createObjectURL(this.#blob), blob: this.#blob}
    }

    download = async ({filename = this.filename()} = {}) => {
        const {url, blob} = await this.url()
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        if (this.isImage()) {
            setTimeout(() => URL.revokeObjectURL(url), 100)
        }
        return blob
    }

    releaseMedia = () => {
        this.#blob = null
        this.#metadata = null
        this.#ratio = null
        this.#dimensions = {width: 0, height: 0}
        this.#type = null
    }
}
