/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoQualityToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * File: VideoQualityToolbar.jsx
 ******************************************************************************/

import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import classNames   from 'classnames'
import { WaButton, WaTooltip }          from '@web.awesome.me/webawesome-pro/dist/react'
import { Fragment } from 'react'
import { useSnapshot }                  from 'valtio'

export const VideoQualityToolbar = ({choicesOnMap = false}) => {
    const $video = lgs.stores.ui.video
    const $videoSettings = lgs.settings.ui.video
    const video = useSnapshot($video)

    /**
     * Updates quality index in store and settings
     * @param {number} index
     */
    const handleChangeQuality = (index) => {
        $video.quality = index
        $videoSettings.quality = index
    }

    return (
        <div className="video-quality-widget">
            <span>{'Quality'}</span>
            <div className={classNames('buttons-bar-on-map', {
                'video-choice-buttons video-choice-buttons-on-map': choicesOnMap,
            })}>
                {ScreenMediaRecorder.QUALITY.map(({name, short}, index) => (
                    <Fragment key={index}>
                        <WaTooltip placement="bottom" for={`q-${index}`}>{name}</WaTooltip>
                        <WaButton
                            id={`q-${index}`}
                            className={classNames('video-choice-button', {'is-selected': index === video.quality})}
                            size="s"
                            variant="neutral"
                            appearance={index === video.quality ? 'outlined' : 'plain'}
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
