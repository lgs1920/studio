/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneModeSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SCENE_MODES }                 from '@Core/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL'
import { useRef, useState }            from 'react'
import { useSnapshot }                 from 'valtio/index'

export const SceneModeSelector = (props) => {
    const settings = useSnapshot(lgs.settings.scene)
    const mainUI = useSnapshot(lgs.stores.ui.mainUI)
    const buttonGroup = useRef(null)
    const placement = props.tooltip ?? 'right'
    const [waitingMode, setWaitingMode] = useState(false)

    const selectSceneMode = (event) => {
        if (waitingMode) {
            __.ui.sceneManager.morph(parseInt(event.target.dataset.sceneMode), __.ui.sceneManager.afterMorphing)
            handleOut(event)
        }
        else {
            handleHover(event)
        }
    }
    const handleOut = (event) => {
        setWaitingMode(false)
    }
    const handleHover = (event) => {
        setWaitingMode(true)
        event.preventDefault()
    }

    return (
        <div ref={buttonGroup} className={'scene-mode-selector'} onMouseLeave={handleOut}
             waiting-mode={waitingMode ? 'true' : 'false'}>

            {
                settings.mode.available.map(mode => (
                    <SlTooltip key={`scene-mode-${SCENE_MODES.get(mode).value}`}
                               placement={placement} hoist content={SCENE_MODES.get(mode).title}>
                        <SlButton size={'small'}
                                  visible={settings.mode.value === SCENE_MODES.get(mode).value}
                                  className={'square-button'} onclick={selectSceneMode}
                                  data-scene-mode={SCENE_MODES.get(mode).value}
                                  disabled={mainUI.rotate.running}>
                            <FontAwesomeIcon slot="prefix" icon={SCENE_MODES.get(mode).icon}
                                             style={{
                                                 '--fa-secondary-color':   lgs.colors.ocean,
                                                 '--fa-secondary-opacity': 1,
                                                 '--fa-primary-color':     lgs.colors.ground,
                                                 '--fa-primary-opacity':   1,
                                             }}/>
                        </SlButton>
                    </SlTooltip>
                ))
            }
        </div>
    )
}