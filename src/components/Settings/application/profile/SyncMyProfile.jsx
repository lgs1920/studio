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

import { DATABASE_SYNC_STATUS }                              from '@Core/db/DatabaseSyncManager'
import { UIToast }                                           from '@Utils/UIToast'
import { WaButton, WaCallout, WaDetails, WaDivider, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useSyncExternalStore }                 from 'react'
import { useConfirm }                                        from '../../../Modals/ConfirmUI'

const EMPTY_SYNC_STATE = {}
const subscribeEmptySyncStatus = () => () => undefined

const getSyncStatusLabel = syncState => {
    switch (syncState?.status) {
        case DATABASE_SYNC_STATUS.CONFLICT:
            return 'The linked profile folder changed outside this browser.'
        case DATABASE_SYNC_STATUS.ERROR:
            return syncState.message || 'Profile synchronization failed.'
        case DATABASE_SYNC_STATUS.PENDING:
            return 'Your profile has local changes that are not synchronized.'
        case DATABASE_SYNC_STATUS.PERMISSION_DENIED:
            return 'Folder permission is required to synchronize your profile.'
        case DATABASE_SYNC_STATUS.SYNCED:
            return 'The synchronization is active.'
        case DATABASE_SYNC_STATUS.IDLE:
        default:
            return 'No synchronization yet.'
    }
}

const ResolveSyncConflictMessage = () => (
    <WaCallout variant="danger" appearance="filled-outlined">
        <WaIcon slot="icon" name="triangle-exclamation" variant="regular"/>
        {'This will overwrite the linked profile folder with the current local profile data.'}
    </WaCallout>
)

/**
 * Renders the profile synchronization controls.
 *
 * This section is responsible for linking/unlinking a persistent folder and
 * for showing the current sync state inline.
 *
 * @return {JSX.Element}
 */
export const SyncMyProfile = () => {
    const databaseSyncManager = lgs.databaseSyncManager
    const syncState = useSyncExternalStore(
        databaseSyncManager?.subscribeSyncStatus ?? subscribeEmptySyncStatus,
        () => databaseSyncManager?.syncState ?? EMPTY_SYNC_STATE,
        () => databaseSyncManager?.syncState ?? EMPTY_SYNC_STATE,
    )
    const advancedSyncSupported = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
    const persistentDirectoryLinked = syncState?.hasPersistentDirectory === true
    const syncStatusLabel = getSyncStatusLabel(syncState)
    const syncNeedsAttention = syncState?.synchronizationRequired === true
    const syncStatus = syncState?.status ?? DATABASE_SYNC_STATUS.IDLE
    const syncHealthy = persistentDirectoryLinked && syncStatus === DATABASE_SYNC_STATUS.SYNCED
    const syncActionLabel = !persistentDirectoryLinked
                            ? 'Activate'
                            : syncStatus === DATABASE_SYNC_STATUS.CONFLICT
                              ? 'Resolve'
                              : syncNeedsAttention
                                ? 'Retry'
                                : 'Deactivate'
    const syncActionIcon = !persistentDirectoryLinked
                           ? 'link-horizontal'
                           : syncStatus === DATABASE_SYNC_STATUS.CONFLICT
                             ? 'triangle-exclamation'
                             : syncNeedsAttention
                               ? 'arrows-rotate'
                               : 'link-horizontal-slash'

    const [ConfirmResolveSyncDialog, confirmResolveSync] = useConfirm(
        'Resolve Profile Synchronization',
        ResolveSyncConflictMessage,
        {
            icon:    'upload',
            text:    'Overwrite folder',
            variant: 'danger',
        },
    )

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

    /**
     * Retries the current folder synchronization.
     *
     * @return {Promise<void>}
     */
    const handleRetrySync = useCallback(async () => {
        try {
            const synchronized = await lgs.databaseSyncManager.flushToPersistentDirectory()
            const nextState = lgs.databaseSyncManager.syncState

            if (synchronized) {
                UIToast.success({
                                    caption: 'Data sync.',
                                    text:    'The synchronization has completed successfully.',
                                })
                return
            }

            UIToast.warning({
                                caption: 'Data sync.',
                                text:    nextState.message,
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Data sync.',
                              text:    error.message,
                          })
        }
    }, [])

    /**
     * Resolves a folder conflict by rewriting it from local data.
     *
     * @return {Promise<void>}
     */
    const handleResolveSync = useCallback(async () => {
        if (!await confirmResolveSync()) {
            return
        }

        try {
            const synchronized = await lgs.databaseSyncManager.overwritePersistentDirectory()
            const nextState = lgs.databaseSyncManager.syncState

            if (synchronized) {
                UIToast.success({
                                    caption: 'Data sync.',
                                    text:    'The linked folder has been overwritten with local profile data.',
                                })
                return
            }

            UIToast.warning({
                                caption: 'Data sync.',
                                text:    nextState.message,
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Data sync.',
                              text:    error.message,
                          })
        }
    }, [confirmResolveSync])

    const handleSyncAction = persistentDirectoryLinked
                             ? syncStatus === DATABASE_SYNC_STATUS.CONFLICT
                               ? handleResolveSync
                               : syncNeedsAttention
                                 ? handleRetrySync
                                 : handleUnlinkDirectory
                             : handleLinkDirectory

    return (
        <WaDetails small className="lgs--details-hoverable" name="profile-tools">
            <span slot="summary">
                <WaIcon
                    className="sync-profile-summary-icon"
                    name={persistentDirectoryLinked ? 'folder-bookmark' : 'folder'}
                    variant="regular"
                    data-variant={syncHealthy ? 'success' : 'danger'}
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
                    <>
                        <WaCallout
                            className="sync-folder-status"
                            variant={syncNeedsAttention ? 'danger' : persistentDirectoryLinked ? 'success' : 'neutral'}
                        >
                            <WaIcon slot="icon" name={persistentDirectoryLinked ? 'folder-bookmark' : 'folder'}
                                    variant="regular"/>
                            <div className="sync-folder-status-main">
                                <span className="sync-folder-status-line-title">{syncStatusLabel}</span>

                            </div>

                            <WaButton
                                className="sync-folder-status-action"
                                variant="brand"
                                appearance="filled"
                                onClick={handleSyncAction}
                            >
                                <WaIcon slot="start" name={syncActionIcon} variant="regular"/>
                                {syncActionLabel}
                            </WaButton>
                        </WaCallout>
                {persistentDirectoryLinked && syncState?.directoryName &&
                    <span className="sync-folder-status-line-detail">
                {`Folder name: ${syncState.directoryName}`}
                    </span>
                }
                    </>


                }
            </div>
            <ConfirmResolveSyncDialog/>
        </WaDetails>
    )
}
