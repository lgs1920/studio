/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Base3DLoadingOverlay.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-29
 * Last modified on: 2026-06-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaCard, WaSpinner } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo }                                from 'react'
import { useSnapshot } from 'valtio'

export const Base3DLoadingOverlay = memo(() => {
    const {components} = useSnapshot(lgs.stores.main)
    const base3dLoading = components?.layers?.base3dLoading === true

    if (!base3dLoading) {
        return null
    }

    return (
        <WaCard className="base3d-loading-overlay lgs--toolbar wa-theme-lgs1920-on-map" role="status" aria-live="polite"
                aria-busy="true">
            <WaSpinner/>
            <span>{'Base loading ...'}</span>
        </WaCard>
    )
})
