/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeModal.jsx
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

import { SlDivider, SlInput, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import React                            from 'react'
import { useSnapshot }                  from 'valtio'

export const WelcomeModal = (props) => {
    const welcome = useSnapshot(lgs.editorSettingsProxy.welcome)
    const switchValue = (event = false) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }
    lgs.editorSettingsProxy.welcome.autoClose = lgs.settings.ui.welcome.autoClose
    lgs.editorSettingsProxy.welcome.showIntro = lgs.settings.ui.welcome.showIntro

    return (
        <>
            <span slot="summary">{'Welcome Modal'}</span>
            <SlDivider/>
            <SlSwitch size="small" align-right checked={lgs.settings.ui.welcome.showIntro}
                      onSlChange={
                          (event) => {
                              lgs.settings.ui.welcome.showIntro = switchValue(event)
                              lgs.editorSettingsProxy.welcome.showIntro = lgs.settings.ui.welcome.showIntro
                          }
                      }>
                {'Show Introduction'}
                <span slot="help-text">{'Each time you launch the application.'}</span>
            </SlSwitch>

            {welcome.showIntro &&
                <>
                    <SlSwitch size="small" align-right checked={lgs.settings.ui.welcome.autoClose}
                              onSlChange={(event) => {
                                  lgs.settings.ui.welcome.autoClose = switchValue(event)
                                  lgs.editorSettingsProxy.welcome.autoClose = lgs.settings.ui.welcome.autoClose
                                  event.preventDefault()
                              }}>
                        {'Auto Close'}
                        <span slot="help-text">{'Allow modal to close automatically'}</span>
                    </SlSwitch>

                    {welcome.autoClose &&
                        <SlInput align-right min={10} small valueAsNumber={lgs.settings.ui.welcome.displayTime}
                                 type="number"
                                 helpText={'Display duration before closing'}
                                 onInput={(event) => lgs.settings.ui.welcome.displayTime = event.target.value * 1}>
                            <label slot="label">{'Display Time'}</label>
                            <div slot="suffix">{'s'}</div>
                        </SlInput>
                    }
                </>
            }
        </>
    )
}