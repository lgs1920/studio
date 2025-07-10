/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-08
 * Last modified: 2025-07-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faCircleVideo }   from '@fortawesome/duotone-regular-svg-icons'
import { FontAwesomeIcon } from '@Components/FontAwesomeIcon'
import { library }         from '@fortawesome/fontawesome-svg-core'

import { SlButton, SlPopup, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useEffect }                    from 'react'
import { useSnapshot }                  from 'valtio'


export const PanelButton = (props) => {

    const $settings = lgs.settings.ui.video
    const settings = useSnapshot($settings)

    useEffect(() => {
    }, [])

    const handleVideoRecording = (event) => {
        $settings.recording = !$settings.recording
    }

    const TimePanel = () => {
        return (
            <SlPopup active={settings.recording}
                     className={'lgs-theme'}
                     anchor="trigger-video-recording"
                     placement={props.tootip}
                     distance={__.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-xs'))}
            >
                <div style={{background: 'red'}}>coucou</div>
            </SlPopup>
        )
    }

    return (
        <>
            <SlTooltip hoist placement={props.tooltip}
                       content={settings.recording ? 'Stop recording' : 'Start recording'}>
                <SlButton size={'small'} className={'square-button transparent'} id={'trigger-video-recording'}
                          onClick={handleVideoRecording}>
                    <FontAwesomeIcon icon={faCircleVideo} beatFade={settings.recording}/>
                </SlButton>
            </SlTooltip>
            <TimePanel/>
        </>
    )
}
