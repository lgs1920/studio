/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneModeSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-11
 * Last modified: 2026-03-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SCENE_MODES }                                             from '@Core/constants'
import { WaButton, WaDropdown, WaDropdownItem, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { Fragment, useRef } from 'react'
import { useSnapshot }                                             from 'valtio/index'

/**
 * Component to select the scene mode via a Web Awesome dropdown.
 * @param {Object} props - Component properties.
 * @param {string} [props.tooltip='right'] - Tooltip placement.
 * @returns {JSX.Element} The rendered dropdown selector.
 */
export const SceneModeSelector = (props) => {
    // Valtio snapshots named after the store attribute
    const scene = useSnapshot(lgs.settings.scene)
    const mainUI = useSnapshot(lgs.stores.ui.mainUI)

    // Ref using the underscore prefix
    const _dropdown = useRef(null)
    const placement = props.tooltip ?? 'right'
    const dropdownPlacement = placement === 'right' ? 'right-start' : 'left-start'

    /**
     * Handles the selection of a new scene mode.
     * @param {CustomEvent} event - The selection event.
     */
    const handleSelect = (event) => {
        const selectedMode = parseInt(event.detail.item.value)
        __.ui.sceneManager.morph(selectedMode, __.ui.sceneManager.afterMorphing)
    }

    const currentModeInfo = SCENE_MODES.get(scene.mode.value)

    return (
        <div className={'scene-mode-selector'}>
            <WaDropdown ref={_dropdown}
                        onWaSelect={handleSelect}
                        placement={dropdownPlacement}
                        distance={lgs.gutter.xs}
            >
                <WaTooltip for="scene-mode-trigger" placement={placement}>{currentModeInfo.title}</WaTooltip>
                <WaButton slot={'trigger'}
                          size={'small'}
                          className={'square-button'}
                          disabled={mainUI.rotate.running}
                          id="scene-mode-trigger"
                          variant={'brand'}
                          appearance="Filled"
                >
                    <WaIcon name={currentModeInfo.icon} variant="regular"/>
                </WaButton>


                {
                    scene.mode.available.map(mode => {
                        const modeData = SCENE_MODES.get(mode)
                        return (
                            <Fragment key={`scene-mode-${modeData.value}`}>
                                <WaTooltip placement={placement}
                                           for={`scene-mode-${modeData.value}`}>{modeData.title}</WaTooltip>
                                <WaDropdownItem
                                    id={`scene-mode-${modeData.value}`}
                                    key={`scene-mode-${modeData.value}`}
                                    value={modeData.value.toString()}
                                >
                                    <WaIcon name={modeData.icon} variant="regular"/>
                                </WaDropdownItem>
                            </Fragment>
                        )
                    })
                }
            </WaDropdown>
        </div>
    )
}