/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: reportZipWorker.js
 *
 ******************************************************************************/

import { zipSync } from 'fflate'

self.onmessage = event => {
    try {
        const archive = zipSync(event.data?.files ?? {}, event.data?.options ?? {})
        self.postMessage({archive}, [archive.buffer])
    }
    catch (error) {
        self.postMessage({error: error?.message ?? 'Report zip failed.'})
    }
}
