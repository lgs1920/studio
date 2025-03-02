/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ResetProfile.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-27
 * Last modified: 2025-02-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faSquareCheck }  from '@fortawesome/duotone-regular-svg-icons'
import { faArrowsRotate } from '@fortawesome/pro-regular-svg-icons'

import { FontAwesomeIcon }                       from '@fortawesome/react-fontawesome'
import { SlButton, SlDetails, SlIcon, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                 from '@Utils/FA2SL'
import React                                     from 'react'
import { useSnapshot }                           from 'valtio/index'
import { useConfirm }                            from '../../../Modals/ConfirmUI'
import './style.css'

export const ResetProfile = () => {
    const editor = lgs.editorSettingsProxy.account
    const snap = useSnapshot(editor)

    const reset = async () => {
        if (await confirmReset()) {
            if (snap.reset.lgs1920) {
                await lgs.db.lgs1920.deleteDB()
            }
            if (snap.reset.settings) {
                await lgs.db.settings.deleteDB()
            }
            if (snap.reset.vault) {
                await lgs.db.vault.deleteDB()
            }
            // Reload the app, the DB will be recreated with defaults
            location.reload()
        }
    }
    const toggleProfileData = (type) => {
        editor.reset[type] = !editor.reset[type]
    }

    const change = (event, type) => {
        toggleProfileData(type)
    }

    const ConfirmationDialogMessage = (props) => {
        return (<>
            <div className="manage-profile-ui">
                {'Are you sure you want to reset the data below?'}
                <ul>
                    {snap.reset.lgs1920 &&
                        <li key={'reset-profile-lgs1920-confirm'}>
                            <FontAwesomeIcon icon={faSquareCheck}/> My journeys, POIs,...
                        </li>
                    }
                    {snap.reset.settings &&
                        <li key={'reset-profile-settings-confirm'}>
                            <FontAwesomeIcon icon={faSquareCheck}/> My settings
                        </li>
                    }{snap.reset.vault &&
                    <li key={'reset-profile-vault-confirm'}>
                        <FontAwesomeIcon icon={faSquareCheck}/> My Tokens
                    </li>
                }
                </ul>
            </div>
        </>)
    }


    const [ConfirmResetDialog, confirmReset] = useConfirm(`Reset My Profile`, ConfirmationDialogMessage,
                                                          {icon: faArrowsRotate, text: 'Reset'})


    return (
        <SlDetails small className={'lgs-theme'}>
            <span slot="summary">
                <SlIcon library="fa" name={FA2SL.set(faArrowsRotate)}/> {'Reset My Profile'}
            </span>
            <div className="manage-profile-ui">
                {'Please select the profile data you wish to reset:'}

                <SlSwitch align-right size="small" checked={snap.reset.lgs1920}
                          onSlChange={(event) => change(event, 'lgs1920')}>
                    Your journeys
                    <span slot="help-text">{'Remove my journeys, POIs...'}</span>
                </SlSwitch>


                <SlSwitch align-right size="small" checked={snap.reset.settings}
                          onSlChange={(event) => change(event, 'settings')}>
                    Your settings
                    <span slot="help-text">{'Reset all my settings and default data.'}</span>
                </SlSwitch>

                <SlSwitch align-right size="small" checked={snap.reset.vault}
                          onSlChange={(event) => change(event, 'vault')}>
                    Your Tokens
                    <span slot="help-text">{'Clear all my tokens for freemium/premium access.'}</span>
                </SlSwitch>

                <SlButton variant="primary" onClick={reset}
                          disabled={!(Object.values(snap.reset).some(value => value === true))}>
                    <SlIcon slot="prefix" library="fa"
                            name={FA2SL.set(faArrowsRotate)}></SlIcon>{'Reset My Profile'}
                </SlButton>
            </div>
            <ConfirmResetDialog/>
        </SlDetails>
    )
}
