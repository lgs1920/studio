/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneModeSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SCENE_MODES }                                             from '@Core/constants'
import { LGSPopup }                                           from '@Components/LGSPopup'
import { WaButton, WaIcon, WaTooltip }                        from '@web.awesome.me/webawesome-pro/dist/react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                                             from 'valtio/index'

/**
 * Component to select the scene mode via a Web Awesome popup.
 * @param {Object} props - Component properties.
 * @param {string} [props.tooltip='right'] - Tooltip placement.
 * @returns {JSX.Element} The rendered scene mode selector.
 */
export const SceneModeSelector = (props) => {
    // Valtio snapshots named after the store attribute
    const scene = useSnapshot(lgs.settings.scene)
    const mainUI = useSnapshot(lgs.stores.ui.mainUI)
    const [open, setOpen] = useState(false)

    // Ref using the underscore prefix
    const _selector = useRef(null)
    const placement = props.tooltip ?? 'right'
    const popupPlacement = placement === 'right' ? 'right-start' : 'left-start'
    const disabled = mainUI.rotate.running || mainUI.panorama.active

    /**
     * Handles the selection of a new scene mode.
     * @param {number} selectedMode - The selected scene mode.
     */
    const handleSelect = useCallback((selectedMode) => {
        setOpen(false)
        if (selectedMode !== scene.mode.value) {
            __.ui.sceneManager.morph(selectedMode, __.ui.sceneManager.afterMorphing)
        }
    }, [scene.mode.value])

    const togglePopup = useCallback(() => {
        setOpen(current => !current)
    }, [])

    useEffect(() => {
        if (!disabled || !open) {
            return
        }

        const animationFrame = window.requestAnimationFrame(() => setOpen(false))
        return () => window.cancelAnimationFrame(animationFrame)
    }, [disabled, open])

    const currentModeInfo = SCENE_MODES.get(scene.mode.value)
    const alternateModes = scene.mode.available.filter(mode => Number(mode) !== Number(scene.mode.value))

    return (
        <div className={'scene-mode-selector toolbar-action-popup-host'} ref={_selector}>
            <WaTooltip for="scene-mode-trigger" placement={placement}>{currentModeInfo.title}</WaTooltip>
            <WaButton size={'s'}
                      className={'square-button'}
                      disabled={disabled}
                      id="scene-mode-trigger"
                      variant={'brand'}
                      appearance="Filled"
                      onClick={togglePopup}
                      aria-haspopup="menu"
                      aria-expanded={open && !disabled ? 'true' : 'false'}
            >
                <WaIcon name={currentModeInfo.icon} variant="regular"/>
            </WaButton>

            <LGSPopup active={open && !disabled && alternateModes.length > 0}
                     anchor="scene-mode-trigger"
                      onRequestClose={() => setOpen(false)}
                     placement={popupPlacement}
                     distance={lgs.gutter.xs}
                     flip
                     shift>
                <div className="toolbar-action-popup" role="menu">
                    {
                        alternateModes.map(mode => {
                            const modeData = SCENE_MODES.get(mode)
                            return (
                                <Fragment key={`scene-mode-${modeData.value}`}>
                                    <WaTooltip placement="top"
                                               for={`scene-mode-${modeData.value}`}>{modeData.title}</WaTooltip>
                                    <WaButton
                                        id={`scene-mode-${modeData.value}`}
                                        className="square-button"
                                        size="s"
                                        variant="brand"
                                        appearance="Filled"
                                        onClick={() => handleSelect(modeData.value)}
                                        role="menuitem"
                                    >
                                        <WaIcon name={modeData.icon} variant="regular"/>
                                    </WaButton>
                                </Fragment>
                            )
                        })
                    }
                </div>
            </LGSPopup>
        </div>
    )
}
