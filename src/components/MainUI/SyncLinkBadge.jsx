/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SyncLinkBadge.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified: 2026-06-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }      from 'valtio'

export const SyncLinkBadge = ({visible = false, className = ''} = {}) => {

    const video = useSnapshot(lgs.stores.ui.video)

    if (!visible) {
        return null
    }

    return (
        <>
        {!video.recording && !video.preRecording && !video.snapshot &&
        <WaButton
            className={`sync-link-badge ${className}`.trim()}
            appearance="filled-outlined"
            variant="warning"
            size="s"
            aria-hidden="true"
            tabIndex={-1}
        >
            <WaIcon name="link-simple" variant="regular"/>
        </WaButton>
        }
        </>
    )
}
