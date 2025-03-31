/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MenuSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-27
 * Last modified: 2025-02-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FAButton }                                from '@Components/FAButton'
import { faArrowsRotate }                          from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlRange, SlSwitch, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import React, { useEffect }                        from 'react'
import { useSnapshot }                             from 'valtio'

export const EditorSettings = (props) => {

    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const toggleUsage = (event) => {

    }
    const setToolbarOpacity = (event) => $journeyToolbar.opacity = event.target.value
    const resetToolbarOpacity = (event) => {
        $journeyToolbar.opacity = $journeyToolbar.defaultOpacity
    }

    useEffect(() => {

    })

    return (
        <>
            <span slot="summary">{'Editors Settings'}</span>
            <SlDivider/>
            <div className="journey-editor-settings">
                <h3>Journeys</h3>
                <SlSwitch size="small" align-right checked={journeyToolbar.usage}
                          onSlChange={(event) => {
                              event.stopImmediatePropagation()
                              $journeyToolbar.usage = switchValue(event)
                              event.preventDefault()
                          }}>
                    {'Show Floating Toolbar'}
                </SlSwitch>
                {journeyToolbar.usage &&
                    <div id="journey-toolbar-opacity">
                        <span>Floating Toolbar Opacity</span>
                        <span><SlTooltip content="Reset to default">
                        <FAButton icon={faArrowsRotate} id={'journey-toolbar-opacity-reset'}
                                  onClick={resetToolbarOpacity}></FAButton>
                        </SlTooltip>
                        <SlRange value={journeyToolbar.opacity * 1.0}
                                 onSlInput={setToolbarOpacity}
                                 min={0.3} max={1} step={0.05} tooltip="top"/>
                    </span>
                    </div>
                }
            </div>
        </>
    )
}