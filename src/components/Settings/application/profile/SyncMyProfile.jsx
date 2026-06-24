/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SyncMyProfile.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-24
 * Last modified: 2026-06-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DATABASE_SYNC_STATUS }                                           from '@Core/db/DatabaseSyncManager'
import {
    LGSScrollbars,
}                                                                         from '@Components/MainUI/LGSScrollbars'
import {
    UIToast,
}                                                                         from '@Utils/UIToast'
import {
    WaBadge, WaButton, WaCallout, WaDialog, WaDetails, WaDivider, WaIcon, WaInput, WaTooltip,
}                                                                         from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useSnapshot }                                                    from 'valtio'
import ReactMarkdown                                                      from 'react-markdown'
import {
    useConfirm,
}                                                                         from '../../../Modals/ConfirmUI'
import {
    markdown as ionTokenHelp,
}                                                                         from '../../../../assets/ion-token-help.md'

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

const formatUsage = (seconds) => {
    const total = Number(seconds)
    if (!Number.isFinite(total) || total < 0) {
        return '00:00'
    }

    const minutes = Math.floor(total / 60)
    const rest = Math.floor(total % 60)
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

const getUsageVariant = (remainingSeconds, totalSeconds) => {
    const total = Number(totalSeconds)
    if (!Number.isFinite(total) || total <= 0) {
        return 'warning'
    }

    const ratio = Number(remainingSeconds) / total
    if (ratio > 0.6) {
        return 'success'
    }

    if (ratio < 0.2) {
        return 'danger'
    }

    return 'warning'
}

const useLiveTick = (enabled) => {
    const [tick, setTick] = useState(0)

    useEffect(() => {
        if (!enabled) {
            return undefined
        }

        const timer = window.setInterval(() => {
            setTick(value => value + 1)
        }, 1000)

        return () => window.clearInterval(timer)
    }, [enabled])

    return tick
}

const IonTokenEditor = ({activeMode, initialToken, promptDelaySeconds, remainingSeconds}) => {
    const inputRef = useRef(null)
    const [canSave, setCanSave] = useState(() => initialToken.trim() !== '')
    const [helpOpen, setHelpOpen] = useState(false)
    const remainingLabel = formatUsage(remainingSeconds)

    const handleSave = async () => {
        try {
            const nextToken = await __.ui.ionTokenManager.save(inputRef.current?.value ?? '')
            if (inputRef.current) {
                inputRef.current.value = nextToken
            }
            setCanSave(nextToken.trim() !== '')
            UIToast.success({
                                caption: 'Cesium Ion token',
                                text:    'A personal Cesium Ion token has been saved.',
                            })
        }
        catch (error) {
            if (inputRef.current) {
                inputRef.current.value = ''
                inputRef.current.focus?.()
            }
            setCanSave(false)
            UIToast.error({
                              caption: 'Cesium Ion token',
                              text:    error.message,
                          })
        }
    }

    const handleClear = async () => {
        try {
            await __.ui.ionTokenManager.clear()
            setCanSave(false)
            if (inputRef.current) {
                inputRef.current.value = ''
            }
            UIToast.success({
                                caption: 'Cesium Ion token',
                                text:    'The personal Cesium Ion token has been removed.',
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Cesium Ion token',
                              text:    error.message,
                          })
        }
    }

    return (
        <div className="manage-profile-ui ion-token-settings">
            <WaCallout open variant={activeMode === 'personal' ? 'success' : 'warning'} appearance="filled-outlined">
                <WaIcon slot="icon" name={activeMode === 'personal' ? 'circle-check' : 'warning'}
                        variant="regular"/>
                {activeMode === 'personal' ? (
                    'Your personal Cesium Ion token is active.'
                ) : (
                    <>
                        {'The shared Cesium Ion token is active.'}
                        <br/>
                        {`Remaining allowance: ${remainingLabel} / ${formatUsage(promptDelaySeconds)}.`}
                    </>
                )}
            </WaCallout>

            <div className="ion-token-settings-toolbar">
                <WaButton
                    appearance="filled"
                    variant="brand"
                    href="https://ion.cesium.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <WaIcon slot="start" name="arrow-up-right-from-square" variant="regular"/>
                    {'Open Cesium Ion'}
                </WaButton>
                <WaButton
                    id="ion-token-help-button"
                    appearance="plain"
                    variant="brand"
                    aria-label="Cesium Ion help"
                    onClick={() => setHelpOpen(true)}
                >
                    <WaIcon name="circle-info" variant="regular"/>
                </WaButton>
                <WaTooltip for="ion-token-help-button" placement="top">{'More information'}</WaTooltip>
            </div>

            <WaInput
                ref={inputRef}
                appearance="filled"
                type="password"
                password-toggle
                autocomplete="off"
                defaultValue={initialToken}
                key={initialToken}
                placeholder={'Paste a Cesium Ion token'}
                onInput={() => {
                    setCanSave((inputRef.current?.value ?? '').trim() !== '')
                }}
            />

            <div className="ion-token-settings-actions">
                <WaButton variant="brand" appearance="outlined" onClick={handleSave} disabled={!canSave}>
                    <WaIcon slot="start" name="check" variant="regular"/>
                    {'Save token'}
                </WaButton>

                <WaButton variant="neutral" appearance="outlined" onClick={handleClear}
                          disabled={activeMode !== 'personal'}>
                    <WaIcon slot="start" name="trash" variant="regular"/>
                    {'Use default'}
                </WaButton>
            </div>

            <WaDialog
                open={helpOpen}
                label="Cesium Ion help"
                className="lgs-theme"
                onWaAfterHide={() => setHelpOpen(false)}
                onWaHide={() => setHelpOpen(false)}
            >
                <div className="ion-token-help-scroll">
                    <LGSScrollbars>
                        <div className="ion-token-help-content wa-prose">
                            <ReactMarkdown>{ionTokenHelp}</ReactMarkdown>
                        </div>
                    </LGSScrollbars>
                </div>
                <WaButton slot="footer" appearance="outlined" variant="brand" onClick={() => setHelpOpen(false)}>
                    <WaIcon slot="start" name="xmark" variant="regular"/>
                    {'Close'}
                </WaButton>
            </WaDialog>
        </div>
    )
}

const IonTokenPanel = () => {
    const ion = useSnapshot(lgs.stores.ion)
    const liveTick = useLiveTick(ion.source !== 'user')
    const promptDelaySeconds = Number.isFinite(Number(lgs.configuration?.ion?.promptDelaySeconds))
                               ? Number(lgs.configuration.ion.promptDelaySeconds)
                               : 480
    const activeMode = ion.source === 'user' ? 'personal' : 'standard'
    const remainingSeconds = Math.max(promptDelaySeconds - Number(ion.accumulatedSeconds ?? 0), 0)
    const badgeVariant = getUsageVariant(remainingSeconds, promptDelaySeconds)
    const remainingLabel = formatUsage(remainingSeconds)
    const initialToken = ion.source === 'user' ? ion.token ?? '' : ''
    const showUsageBadge = ion.source !== 'user'

    return (
        <WaDetails small className="lgs--details-hoverable" name="profile-tools" data-live-tick={liveTick}>
            <span slot="summary" className="ion-token-summary">
                <span className="ion-token-summary-title">
                    <WaIcon name="cloud" variant="regular"/>
                    {'Cesium Ion'}
                </span>
                <span className="ion-token-summary-meta">
                    {showUsageBadge && (
                        <WaBadge variant={badgeVariant} appearance="filled">
                            {`${remainingLabel} left`}
                        </WaBadge>
                    )}
                </span>
            </span>
            <IonTokenEditor
                key={`${ion.source}:${initialToken}`}
                activeMode={activeMode}
                initialToken={initialToken}
                promptDelaySeconds={promptDelaySeconds}
                remainingSeconds={remainingSeconds}
            />
        </WaDetails>
    )
}

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
        <>
            <WaDetails small className="lgs--details-hoverable" name="profile-tools">
                <span slot="summary">
                    <WaIcon
                        className="sync-profile-summary-icon"
                        name={persistentDirectoryLinked ? 'folder-bookmark' : 'folder'}
                        variant="regular"
                        data-variant={syncHealthy ? 'success' : 'danger'}
                    />
                    {' '}
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

                    {advancedSyncSupported && (
                        <WaCallout
                            className="sync-folder-status"
                            variant={syncNeedsAttention ? 'danger' : persistentDirectoryLinked ? 'success' : 'neutral'}
                            appearance="filled-outlined"
                        >
                            <div className="sync-folder-status-main">
                                <div className="sync-folder-status-line">
                                    <WaIcon
                                        name={persistentDirectoryLinked ? 'folder-bookmark' : 'folder'}
                                        variant="regular"
                                        className="sync-profile-summary-icon"
                                        data-variant={syncHealthy ? 'success' : 'danger'}
                                    />
                                    <span className="sync-folder-status-line-title">
                                        {persistentDirectoryLinked ? 'Linked folder' : 'No linked folder'}
                                    </span>
                                </div>
                                <div className="sync-folder-status-line-detail">
                                    {syncStatusLabel}
                                </div>
                            </div>

                            <WaButton
                                appearance="outlined"
                                variant={syncHealthy ? 'neutral' : 'brand'}
                                className="sync-folder-status-action"
                                onClick={handleSyncAction}
                            >
                                <WaIcon slot="start" name={syncActionIcon} variant="regular"/>
                                {syncActionLabel}
                            </WaButton>
                        </WaCallout>
                    )}
                </div>
                <ConfirmResolveSyncDialog/>
            </WaDetails>
            <IonTokenPanel/>
        </>
    )
}
