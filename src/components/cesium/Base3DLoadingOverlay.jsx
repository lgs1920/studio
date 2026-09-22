/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Base3DLoadingOverlay.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-30
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaCard, WaSpinner } from '@web.awesome.me/webawesome-pro/dist/react'
import { useProxyValue }      from '@Utils/ValtioUtils'
import { memo }                                from 'react'

export const Base3DLoadingOverlay = memo(() => {
    const base3dLoading = useProxyValue(lgs.stores.main, main => main.components?.layers?.base3dLoading === true, false)

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
