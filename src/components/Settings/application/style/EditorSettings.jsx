/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: EditorSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-19
 * Last modified: 2025-07-19
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

    const $toolbars = lgs.settings.ui.toolbars
    const toolbars = useSnapshot($toolbars)
    const $journeyToolbar = lgs.settings.ui.journeyToolbar
    const journeyToolbar = useSnapshot($journeyToolbar)

    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }

    const toggleUsage = (event) => {

    }
    const setToolbarOpacity = (event) => $toolbars.opacity = event.target.value
    const resetToolbarOpacity = (event) => {
        $toolbars.opacity = toolbars.defaultOpacity
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
                    {'Add Journey Toolbar'}
                </SlSwitch>
                <h3>Toolbars</h3>
                <div id="toolbars-opacity">
                        <span>Floating Toolbar Opacity</span>
                        <span><SlTooltip content="Reset to default">
                        <FAButton icon={faArrowsRotate} id={'toolbars-opacity-reset'}
                                  onClick={resetToolbarOpacity}></FAButton>
                        </SlTooltip>
                        <SlRange value={toolbars.opacity * 1.0}
                                 onSlInput={setToolbarOpacity}
                                 min={0.3} max={1} step={0.05} tooltip="top"/>
                    </span>
                    </div>
            </div>
        </>
    )
}