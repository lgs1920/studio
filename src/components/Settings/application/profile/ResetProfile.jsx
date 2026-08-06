/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ResetProfile.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-22
 * Last modified: 2026-06-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGETS_STORE } from '@Core/constants'

import { WaButton, WaDetails, WaDivider, WaIcon, WaSwitch } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                                      from 'valtio/index'
import { useConfirm }                                       from '../../../Modals/ConfirmUI'
import './style.css'

/**
 * Component to manage and reset user profile data.
 * Handles different categories of data like settings, widgets, and vault.
 */
export const ResetProfile = () => {
    const $account = lgs.stores.editorSettings.account
    const account = useSnapshot($account)

    /**
     * Executes the reset logic for selected categories.
     * Deletes databases and reloads the application.
     */
    const reset = async () => {
        if (await confirmReset()) {
            await lgs.databaseSyncManager?.unlinkPersistentDirectory?.()
            await __.ui.ionTokenManager?.resetIntroSeen?.()
            await __.ui.ionTokenManager?.clear?.()

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

            location.reload()
        }
    }

    /**
     * Component for the confirmation dialog content.
     */
    const ConfirmationDialogMessage = () => {
        return (
            <div className="manage-profile-ui">
                {'Are you sure you want to reset the data below?'}
                <ul>
                    {account.reset.lgs1920 &&
                        <li key={'reset-profile-lgs1920-confirm'}>
                            <WaIcon name="square-check" variant="regular"/> {'My journeys, POIs,...'}
                        </li>
                    }
                    {account.reset.widgets &&
                        <li key={'reset-profile-widgets-confirm'}>
                            <WaIcon name="box" variant="regular"/> {'All my widgets'}
                        </li>
                    }
                    {account.reset.settings &&
                        <li key={'reset-profile-settings-confirm'}>
                            <WaIcon name="square-check" variant="regular"/> {'My settings'}
                        </li>
                    }
                    {account.reset.vault &&
                        <li key={'reset-profile-vault-confirm'}>
                            <WaIcon name="square-check" variant="regular"/> {'My Tokens'}
                        </li>
                    }
                </ul>
            </div>
        )
    }

    const [ConfirmResetDialog, confirmReset] = useConfirm(`Reset My Profile`, ConfirmationDialogMessage,
                                                          {
                                                              icon:    'arrows-rotate',
                                                              text:    'Reset Profile',
                                                              variant: 'warning',
                                                          })

    /**
     * Explicit check to determine if at least one reset option is selected.
     * Prevents issues with Object.values on proxy snapshots.
     */
    const isResetDisabled = !account.reset.lgs1920 &&
        !account.reset.widgets &&
        !account.reset.settings &&
        !account.reset.vault

    return (
        <WaDetails small className={'lgs--details-hoverable'} name="profile-tools">
            <span slot="summary">
                <WaIcon name="arrows-rotate" variant="regular"/> {'Profile Reset'}
            </span>
            <div className="manage-profile-ui">
                <WaDivider/>
                {'Select the profile data to reset:'}

                <WaSwitch
                    label-at-start
                    size="xs"
                    checked={account.reset.lgs1920}
                    onChange={(event) => {
                        $account.reset.lgs1920 = event.target.checked
                    }}
                >
                    {'My journeys'}
                    <span slot="hint">{'Remove my journeys, pois..'}</span>
                </WaSwitch>

                <WaSwitch
                    label-at-start
                    size="xs"
                    checked={account.reset.widgets}
                    onChange={(event) => {
                        $account.reset.widgets = event.target.checked
                    }}
                >
                    {'My widgets'}
                    <span slot="hint">{'Remove my widgets, pois..'}</span>
                </WaSwitch>

                <WaSwitch
                    label-at-start
                    size="xs"
                    checked={account.reset.settings}
                    onChange={(event) => {
                        $account.reset.settings = event.target.checked
                    }}
                >
                    {'My settings'}
                    <span slot="hint">{'Reset all my settings and default data.'}</span>
                </WaSwitch>

                <WaSwitch
                    label-at-start
                    size="xs"
                    checked={account.reset.vault}
                    onChange={(event) => {
                        $account.reset.vault = event.target.checked
                    }}
                >
                    {'My Tokens'}
                    <span slot="hint">{'Clear all my tokens for freemium/premium access.'}</span>
                </WaSwitch>

                <WaButton
                    variant="danger"
                    appearance="filled"
                    onClick={reset}
                    disabled={isResetDisabled}
                >
                    <WaIcon slot="start" name="arrows-rotate" variant="regular"/>
                    {'Reset Profile'}
                </WaButton>
            </div>
            <ConfirmResetDialog/>
        </WaDetails>
    )
}
