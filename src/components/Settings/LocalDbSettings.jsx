/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LocalDbSettings.jsx
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
import { UIToast } from '@Utils/UIToast'
import { useCallback } from 'react'
import './application/profile/style.css'

/**
 * Renders the import/export actions for the local application databases.
 *
 * This block focuses on portable ZIP backups and restore operations.
 *
 * @return {JSX.Element}
 */
export const LocalDbSettings = () => {
    /**
     * Exports the current databases as a ZIP archive.
     *
     * @return {Promise<void>}
     */
    const handleExport = useCallback(async () => {
        try {
            await lgs.databaseSyncManager.downloadZipBackup('lgs1920-backup.zip')
            UIToast.success({
                                caption: 'Database backup',
                                text:    'The local databases were exported as a ZIP archive.',
                            })
        }
        catch (error) {
            UIToast.error({
                              caption: 'Database backup',
                              text:    error.message,
                          })
        }
    }, [])

    /**
     * Imports a ZIP archive into the local databases and reloads the application.
     *
     * @param {Event} event - File input change event.
     * @return {Promise<void>}
     */
    const handleImportChange = useCallback(async event => {
        const file = event.target.files?.[0] ?? null
        event.target.value = ''

        if (!file) {
            return
        }

        try {
            await lgs.databaseSyncManager.processZipUpload(file)
            UIToast.success({
                                caption: 'Database restore',
                                text:    'The local databases were restored from the archive.',
                            })
            window.setTimeout(() => location.reload(), 250)
        }
        catch (error) {
            UIToast.error({
                              caption: 'Database restore',
                              text:    error.message,
                          })
        }
    }, [])

    /**
     * Opens the archive input used for local database imports.
     */
    const openImportPicker = useCallback(() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.zip,application/zip'
        input.hidden = true
        input.addEventListener('change', async event => {
            try {
                await handleImportChange(event)
            }
            finally {
                input.remove()
            }
        }, {once: true})
        document.body.appendChild(input)
        input.click()
    }, [handleImportChange])

    return (
        <WaDetails small className="lgs--details-hoverable" name="profile-tools">
            <span slot="summary">
                <WaIcon name="file-export" variant="regular"/> {'Import/Export'}
            </span>

            <div className="manage-profile-ui">
                <WaDivider/>

                <WaCallout open variant="neutral">
                    <WaIcon slot="icon" name="circle-info" variant="regular"/>
                    {'Export or import your user profile.'}
                </WaCallout>

                <div className="lgs-profile-import-export-actions">
                    <WaButton variant="brand" appearance="outlined" onClick={handleExport}>
                        <WaIcon slot="start" name="file-arrow-down" variant="regular"/>
                        {'Export'}
                    </WaButton>

                    <WaButton variant="brand" appearance="outlined" onClick={openImportPicker}>
                        <WaIcon slot="start" name="file-arrow-up" variant="regular"/>
                        {'Import'}
                    </WaButton>
                </div>
            </div>
        </WaDetails>
    )
}
