/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SyncMyProfile.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-22
 * Last modified: 2026-06-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaCallout, WaDetails, WaDivider, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { UIToast }                                           from '@Utils/UIToast'
import { useCallback } from 'react'

/**
 * Renders the profile synchronization controls.
 *
 * This section is responsible for linking/unlinking a persistent folder and
 * for showing the current sync state inline.
 *
 * @return {JSX.Element}
 */
export const SyncMyProfile = () => {
    const advancedSyncSupported = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
    const persistentDirectoryLinked = lgs.databaseSyncManager?.hasPersistentDirectory === true
    const syncStatusLabel = persistentDirectoryLinked
                           ? 'The synchronization is active.'
                           : 'No synchronization yet.'

    /**
     * Links a local folder and imports its current content.
     *
     * @return {Promise<void>}
     */
    const handleLinkDirectory = useCallback(async () => {
        try {
            await lgs.databaseSyncManager.linkPersistentDirectory()
            UIToast.success({
                                caption: 'Data sync.',
                                text:    'The synchronization has been activated successfully.',
                            })
            window.setTimeout(() => location.reload(), 250)
        }
        catch (error) {
            if (error?.name === 'AbortError') {
                return
            }

            UIToast.error({
                              caption: 'Data sync.',
                              text:    error.message,
                          })
        }
    }, [])

    /**
     * Unlinks the current folder synchronization target.
     *
     * @return {Promise<void>}
     */
    const handleUnlinkDirectory = useCallback(async () => {
        try {
            await lgs.databaseSyncManager.unlinkPersistentDirectory()
            UIToast.success({
                                caption: 'Data sync.',
                                text:    'The sync has been deactivated successfully.',
                            })
            window.setTimeout(() => location.reload(), 250)
        }
        catch (error) {
            UIToast.error({
                              caption: 'Data sync.',
                              text:    error.message,
                          })
        }
    }, [])

    return (
        <WaDetails small className="lgs--details-hoverable" name="profile-tools">
            <span slot="summary">
                <WaIcon
                    name={persistentDirectoryLinked ? 'folder-bookmark' : 'folder'}
                    variant={persistentDirectoryLinked ? 'success' : 'warning'}
                /> {' '}
                {'Sync Profile'}
            </span>

            <div className="manage-profile-ui">
                <WaDivider/>

                {!advancedSyncSupported && (
                    <WaCallout className="manage-profile-ui-sync-unsupported" variant="neutral">
                        <WaIcon name="ban" variant="regular" slot="icon"/>
                        {'This browser only supports the manual backup workflow.'}
                    </WaCallout>
                )}

                {advancedSyncSupported &&
                    <WaCallout
                        className="sync-folder-status" variant={persistentDirectoryLinked ? 'success' : 'neutral'}>
                        <WaIcon slot="icon" name={persistentDirectoryLinked ? 'folder-bookmark' : 'folder'}
                                variant="regular"/>
                        <span>{syncStatusLabel}</span>

                        <WaButton
                            className="sync-folder-status-action"
                            variant="brand"
                            appearance="filled"
                            onClick={persistentDirectoryLinked ? handleUnlinkDirectory : handleLinkDirectory}
                        >
                            <WaIcon slot="start"
                                    name={persistentDirectoryLinked ? 'link-horizontal-slash' : 'link-horizontal'}
                                    variant="regular"/>
                            {persistentDirectoryLinked ? 'Deactivate' : 'Activate'}
                        </WaButton>
                    </WaCallout>
                }
            </div>
        </WaDetails>
    )
}
