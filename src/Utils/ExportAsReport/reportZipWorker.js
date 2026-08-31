/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: reportZipWorker.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
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
