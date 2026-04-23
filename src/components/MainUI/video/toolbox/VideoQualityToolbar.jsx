/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoQualityToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-23
 * Last modified: 2026-04-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * File: VideoQualityToolbar.jsx
 ******************************************************************************/

import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { WaButton, WaTooltip }          from '@web.awesome.me/webawesome-pro/dist/react'
import React, { Fragment, useCallback } from 'react'
import { useSnapshot }                  from 'valtio'

export const VideoQualityToolbar = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    /**
     * Updates quality index in store and settings
     * @param {number} index
     */
    const handleChangeQuality = useCallback((index) => {
        $video.quality = index
        lgs.settings.ui.video.quality = index

        if (lgs.settings.ui.video.adaptiveQuality?.enabled) {
            lgs.settings.ui.video.adaptiveQuality = {...lgs.settings.ui.video.adaptiveQuality, enabled: false}
        }
    }, [$video])

    return (
        <div className="video-quality-widget">
            <span>{'Quality'}</span>
            <div className="buttons-bar-on-map">
                {ScreenMediaRecorder.QUALITY.map(({name, short}, index) => (
                    <Fragment key={index}>
                        <WaTooltip placement="bottom" for={`q-${index}`}>{name}</WaTooltip>
                        <WaButton
                            id={`q-${index}`}
                            size="small"
                            variant="on-map"
                            appearance={index === video.quality ? 'accent' : 'outlined'}
                            onClick={() => handleChangeQuality(index)}
                        >
                            {short}
                        </WaButton>
                    </Fragment>
                ))}
            </div>
        </div>
    )
}