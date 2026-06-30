/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Base3DLoadingOverlay.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-29
 * Last modified on: 2026-06-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { memo } from 'react'
import { useSnapshot } from 'valtio'
import './Base3DLoadingOverlay.css'

export const Base3DLoadingOverlay = memo(() => {
    const {components} = useSnapshot(lgs.stores.main)
    const base3dLoading = components?.layers?.base3dLoading === true

    const closeOverlay = () => {
        lgs.stores.main.components.layers.base3dLoading = false
    }

    if (!base3dLoading) {
        return null
    }

    return (
        <div className="base3d-loading-overlay" role="status" aria-live="polite" aria-busy="true">
            <div className="base3d-loading-panel">
                <WaButton
                    className="base3d-loading-close square-button"
                    appearance="plain"
                    variant="neutral"
                    size="x-small"
                    aria-label="Close loading overlay"
                    onClick={closeOverlay}
                >
                    <WaIcon name="xmark" variant="regular"/>
                </WaButton>
                <div className="base3d-loading-spinner" aria-hidden="true"/>
                <div className="base3d-loading-text">
                    <span>{'New base loading ...'}</span>
                </div>
            </div>
        </div>
    )
})
