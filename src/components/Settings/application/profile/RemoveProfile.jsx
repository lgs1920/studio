/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: RemoveProfile.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-11-17
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaCallout, WaDetails, WaDivider, WaIcon } from '@awesome.me/webawesome/dist/react'
import { cartographicCacheController } from '@Core/cache/CartographicCacheController'
import { UI_ACTIONS, UI_ICONS }                             from '@Core/ui/metadata/uiActionCatalog'
import { useState }                                          from 'react'
import { useConfirm }                           from '../../../Modals/ConfirmUI'
import './style.css'

/** Render the profile deletion flow, including acknowledged local tile-cache removal. */
export const RemoveProfile = () => {
    const [removing, setRemoving] = useState(false)
    const [removalError, setRemovalError] = useState('')

    /** Delete local databases only after the service worker confirms every tile partition is gone. */
    const remove = async () => {
        if (!await confirmRemove()) return
        setRemoving(true)
        setRemovalError('')
        try {
            await cartographicCacheController.deleteAll()
            await lgs.db.lgs1920.deleteDB()
            await lgs.db.settings.deleteDB()
            await lgs.db.vault.deleteDB()
            // Redirect to the website so the databases will not be recreated.
            location.href = `${lgs.servers.site.protocol}://${lgs.servers.site.domain}`
        }
        catch (error) {
            setRemovalError(error instanceof Error ? error.message : 'Studio data could not be deleted.')
        }
        finally {
            setRemoving(false)
        }
    }

    /** Render the confirmation copy used by the profile removal dialog. */
    const ConfirmationDialogMessage = () => {
        return (
            <div className="manage-profile-ui">
                {'Are you sure you want to remove your account?'}
                <WaCallout open variant="danger">
                    <WaIcon slot="icon" {...UI_ICONS.warning}/>
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
                <WaIcon {...UI_ACTIONS.remove.icon}/> {`${UI_ACTIONS.remove.label} Profile`}
            </span>
            <div className="manage-profile-ui">
                <WaDivider/>
                {removalError && <WaCallout open role="alert" variant="danger" appearance="filled-outlined">{removalError}</WaCallout>}
                <WaCallout open variant="danger" appearance="filled-outlined">
                    <WaIcon slot="icon" {...UI_ICONS.warning}/>
                    {'You will delete all the data and databases that your browser has stored on your device in order to manage LGS1920 Studio application.'}<br/>
                    {'It includes journeys, POIS, settings, tokens ...'}<br/>
                    {'It also clears local map tiles and metadata from every account partition.'}<br/>
                </WaCallout>

                <WaButton variant="danger" loading={removing} disabled={removing} onClick={remove}>
                    <WaIcon slot="start" {...UI_ACTIONS.remove.icon}/>{`${UI_ACTIONS.remove.label} Profile`}
                </WaButton>
            </div>
            <ConfirmRemoveDialog/>
        </WaDetails>
    )
}
