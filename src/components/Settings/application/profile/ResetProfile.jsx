/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ResetProfile.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGETS_STORE }                        from '@Core/constants'
import { faSquareCheck, faArrowsRotate, faBox } from '@fortawesome/duotone-regular-svg-icons'
import {}                                       from '@fortawesome/pro-regular-svg-icons'

import { FontAwesomeIcon }                       from '@fortawesome/react-fontawesome'
import { SlButton, SlDetails, SlIcon, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                 from '@Utils/FA2SL'
import React                                     from 'react'
import { useSnapshot }                           from 'valtio/index'
import { useConfirm }                            from '../../../Modals/ConfirmUI'
import './style.css'

export const ResetProfile = () => {
    const $account = lgs.stores.editorSettings.account
    const account = useSnapshot($account)

    const reset = async () => {
        if (await confirmReset()) {
            if (account.reset.lgs1920) {
                await lgs.db.lgs1920.deleteDB()
            }
            if (account.reset.settings) {
                await lgs.db.settings.deleteDB()
            }
            if (account.reset.vault) {
                await lgs.db.vault.deleteDB()
            }

            if (account.reset.widgets) {
                await lgs.db.lgs1920.clear(WIDGETS_STORE)
            }
            // Reload the app, the DB will be recreated with defaults
            location.reload()
        }
    }
    const toggleProfileData = (type) => {
        $account.reset[type] = !$account.reset[type]
    }

    const change = (event, type) => {
        toggleProfileData(type)
    }

    const ConfirmationDialogMessage = (props) => {
        return (<>
            <div className="manage-profile-ui">
                {'Are you sure you want to reset the data below?'}
                <ul>
                    {account.reset.lgs1920 &&
                        <li key={'reset-profile-lgs1920-confirm'}>
                            <FontAwesomeIcon icon={faSquareCheck}/> My journeys, POIs,...
                        </li>
                    }
                    {account.reset.widgets &&
                        <li key={'reset-profile-widgets-confirm'}>
                            <FontAwesomeIcon icon={faBox}/> All my widgets
                        </li>
                    }
                    {account.reset.settings &&
                        <li key={'reset-profile-settings-confirm'}>
                            <FontAwesomeIcon icon={faSquareCheck}/> My settings
                        </li>
                    }
                    {account.reset.vault &&
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
                {'Please select the profile data to reset:'}

                <SlSwitch align-right size="small" checked={account.reset.lgs1920}
                          onSlChange={(event) => change(event, 'lgs1920')}>
                    My journeys
                    <span slot="help-text">{'Remove my journeys, pois..'}</span>
                </SlSwitch>

                <SlSwitch align-right size="small" checked={account.reset.widgets}
                          onSlChange={(event) => change(event, 'widgets')}>
                    My widgets
                    <span slot="help-text">{'Remove my widgets, pois..'}</span>
                </SlSwitch>
                <SlSwitch align-right size="small" checked={account.reset.settings}
                          onSlChange={(event) => change(event, 'settings')}>
                    My settings
                    <span slot="help-text">{'Reset all my settings and default data.'}</span>
                </SlSwitch>

                <SlSwitch align-right size="small" checked={account.reset.vault}
                          onSlChange={(event) => change(event, 'vault')}>
                    My Tokens
                    <span slot="help-text">{'Clear all my tokens for freemium/premium access.'}</span>
                </SlSwitch>

                <SlButton variant="primary" onClick={reset}
                          disabled={!(Object.values(account.reset).some(value => value === true))}>
                    <SlIcon slot="prefix" library="fa"
                            name={FA2SL.set(faArrowsRotate)}></SlIcon>{'Reset My Profile'}
                </SlButton>
            </div>
            <ConfirmResetDialog/>
        </SlDetails>
    )
}
