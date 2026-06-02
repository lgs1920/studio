/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RemoveProfile.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-22
 * Last modified: 2026-03-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faTrashAlt, faWarning }                from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlButton, SlDetails, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                             from '@Utils/FA2SL'
import { WaButton, WaCallout, WaDetails, WaDivider, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React                                                 from 'react'
import { useSnapshot }                          from 'valtio/index'
import { useConfirm }                           from '../../../Modals/ConfirmUI'
import './style.css'

export const RemoveProfile = () => {
    const editor = lgs.editorSettingsProxy.account
    const snap = useSnapshot(editor)

    const remove = async () => {
        if (await confirmRemove()) {
            await lgs.db.lgs1920.deleteDB()
            await lgs.db.settings.deleteDB()
            await lgs.db.vault.deleteDB()
            // redirection to the website so the DB won't be recreated
            location.href = `${lgs.servers.site.protocol}://${lgs.servers.site.domain}`
        }
    }

    const ConfirmationDialogMessage = (props) => {
        return (
            <div className="manage-profile-ui">
                {'Are you sure you want to remove your account?'}
                <WaCallout open variant="danger">
                    <WaIcon slot="icon" name="warning" variant="regular"/>
                    {'If you confirm your action, you will be redirected to our site.'}<br/>
                    {'None of our data will be stored in your browser.'}<br/>
                </WaCallout>
            </div>
        )
    }

    const [ConfirmRemoveDialog, confirmRemove] = useConfirm(`Remove My Profile`, ConfirmationDialogMessage,
                                                            {
                                                                text: 'Remove My Profile',
                                                                variant: 'danger',
                                                                icon: 'trash-alt',
                                                            })

    return (
        <WaDetails small className={'lgs--details-hoverable'} name="profile-tools">
            <span slot="summary">
                <WaIcon name="trash-alt" variant="regular"/> {'Remove Profile'}
            </span>
            <div className="manage-profile-ui">
                <WaDivider/>
                <WaCallout open variant="danger" appearance="filled-outlined">
                    <WaIcon slot="icon" name="warning" variant="regular"/>
                    {'You will delete all the data and databases that your browser has stored on your device in order to manage LGS1920 Studio application.'}<br/>
                    {'It includes journeys, POIS, settings, tokens ...'}<br/>
                </WaCallout>

                <WaButton variant="danger" onClick={remove}>
                    <WaIcon slot="start" name="trash-alt" variant="regular"/>{'Remove Profile'}
                </WaButton>
            </div>
            <ConfirmRemoveDialog/>
        </WaDetails>
    )
}
