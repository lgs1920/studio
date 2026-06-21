/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DatabaseSyncManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-21
 * Last modified: 2026-06-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    exportDatabaseBundleToZip,
    importDatabaseBundleFromZip,
} from './DatabaseExportImportUtils'

export class DatabaseSyncManager {
    #databases = null

    constructor(databases = null) {
        this.#databases = databases
    }

    setDatabases = databases => {
        this.#databases = databases
    }

    exportZipBackup = async (databases = null, options = {}) => {
        return exportDatabaseBundleToZip(databases ?? this.#databases, options)
    }

    importZipBackup = async (archive, databases = null, options = {}) => {
        return importDatabaseBundleFromZip(databases ?? this.#databases, archive, options)
    }

    downloadZipBackup = async (fileName = 'lgs1920-backup.zip', options = {}) => {
        const archive = await this.exportZipBackup(null, options)
        const blob = new Blob([archive], {type: 'application/zip'})
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        link.click()
        URL.revokeObjectURL(link.href)
    }

    processZipUpload = async (fileObject, options = {}) => {
        if (!fileObject) {
            throw new Error('No file provided.')
        }
        return this.importZipBackup(fileObject, null, options)
    }
}

