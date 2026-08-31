/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: update-file-headers.mjs
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-31
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync, writeFileSync} from 'node:fs'
import {basename, extname} from 'node:path'
import {spawnSync} from 'node:child_process'

const SOURCE_EXTENSIONS = new Set(['.css', '.js', '.jsx', '.ts', '.tsx'])
const VITEST_DIRECTIVE_PATTERN = /^\/\/ @vitest-environment[^\n]*\n?/
const PROJECT_HEADER_PATTERN = /^\/\*\*+[\s\S]*?This file is part of the LGS1920\/studio project\.[\s\S]*?\n \*{3,}\/\s*/

/**
 * Run a Git command and return its result.
 *
 * @param {string[]} argumentsList - Git command arguments.
 * @returns {{status: number, stdout: string, stderr: string}} Git command result.
 */
export const runGit = argumentsList => {
    const result = spawnSync('git', argumentsList, {encoding: 'utf8'})

    return {
        status: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
    }
}

/**
 * Return today's date in the project date format.
 *
 * @returns {string} Current date formatted as YYYY-MM-DD.
 */
export const getCurrentDate = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Europe/Paris',
        year: 'numeric',
    }).formatToParts(new Date()).reduce((values, part) => {
        values[part.type] = part.value
        return values
    }, {})

    return `${parts.year}-${parts.month}-${parts.day}`
}

/**
 * Return whether a file is a supported source-code file.
 *
 * @param {string} filePath - Relative repository file path.
 * @returns {boolean} True when the file extension is supported.
 */
export const isSupportedSourceFile = filePath => SOURCE_EXTENSIONS.has(extname(filePath).toLowerCase())

/**
 * Return the last non-empty line from command output.
 *
 * @param {string} output - Command output.
 * @returns {string} Last non-empty output line.
 */
const lastOutputLine = output => output.trim().split('\n').filter(Boolean).at(-1) ?? ''

/**
 * Return the date of the first commit that introduced a file.
 *
 * @param {string} filePath - Relative repository file path.
 * @param {string} fallbackDate - Date used when the file has no Git history.
 * @returns {string} File creation date.
 */
export const getCreatedDate = (filePath, fallbackDate = getCurrentDate()) => {
    const result = runGit(['log', '--follow', '--diff-filter=A', '--format=%cd', '--date=short', '--', filePath])
    return lastOutputLine(result.stdout) || fallbackDate
}

/**
 * Return the date of the latest committed change to a file.
 *
 * @param {string} filePath - Relative repository file path.
 * @param {string} fallbackDate - Date used when the file has no Git history.
 * @returns {string} Latest committed modification date.
 */
export const getLastCommittedDate = (filePath, fallbackDate = getCurrentDate()) => {
    const result = runGit(['log', '--follow', '-1', '--format=%cd', '--date=short', '--', filePath])
    return lastOutputLine(result.stdout) || fallbackDate
}

/**
 * Return whether a file differs from the current Git commit.
 *
 * @param {string} filePath - Relative repository file path.
 * @returns {boolean} True when the file is new or currently modified.
 */
export const hasCurrentChange = filePath => runGit(['diff', '--quiet', 'HEAD', '--', filePath]).status !== 0

/**
 * Build the canonical project header for one file.
 *
 * @param {string} filePath - Relative repository file path.
 * @param {string} createdDate - File creation date.
 * @param {string} modifiedDate - Last modification date.
 * @returns {string} Canonical source file header.
 */
export const buildHeader = (filePath, createdDate, modifiedDate) => `/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ${basename(filePath)}
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: ${createdDate}
 * Last modified: ${modifiedDate}
 *
 *
 * Copyright © ${modifiedDate.slice(0, 4)} LGS1920
 ******************************************************************************/`

/**
 * Replace or insert the canonical project header in source content.
 *
 * @param {string} content - Current file content.
 * @param {string} filePath - Relative repository file path.
 * @param {string} createdDate - File creation date.
 * @param {string} modifiedDate - Last modification date.
 * @returns {string} Updated file content.
 */
export const updateHeader = (content, filePath, createdDate, modifiedDate) => {
    const vitestDirective = content.match(VITEST_DIRECTIVE_PATTERN)?.[0] ?? ''
    const contentAfterDirective = content.slice(vitestDirective.length)
    const contentWithoutHeader = contentAfterDirective.replace(PROJECT_HEADER_PATTERN, '').replace(/^\n+/, '')
    const header = buildHeader(filePath, createdDate, modifiedDate)

    return `${vitestDirective}${header}\n\n${contentWithoutHeader}`
}

/**
 * Return the staged repository files selected for header processing.
 *
 * @returns {string[]} Staged source-code file paths.
 */
export const getStagedFiles = () => runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).stdout
    .split('\n')
    .map(filePath => filePath.trim())
    .filter(filePath => filePath && isSupportedSourceFile(filePath))

/**
 * Ensure a staged file has no unstaged changes before rewriting it.
 *
 * @param {string} filePath - Relative repository file path.
 * @returns {boolean} True when the worktree and index are synchronized.
 */
export const isWorktreeSynchronized = filePath => runGit(['diff', '--quiet', '--', filePath]).status === 0

/**
 * Update one source file and optionally stage the resulting content.
 *
 * @param {string} filePath - Relative repository file path.
 * @param {boolean} checkOnly - Whether to report differences without writing.
 * @param {boolean} stageChanges - Whether to stage a changed file.
 * @returns {boolean} True when the file already matched or was updated successfully.
 */
export const processFile = (filePath, checkOnly, stageChanges) => {
    const currentDate = getCurrentDate()
    const createdDate = getCreatedDate(filePath, currentDate)
    const modifiedDate = hasCurrentChange(filePath) ? currentDate : getLastCommittedDate(filePath, currentDate)
    const content = readFileSync(filePath, 'utf8')
    const updatedContent = updateHeader(content, filePath, createdDate, modifiedDate)

    if (content === updatedContent) {
        return true
    }

    console.log(`${checkOnly ? 'Missing or outdated header' : 'Updating header'}: ${filePath}`)

    if (checkOnly) {
        return false
    }

    writeFileSync(filePath, updatedContent)

    if (stageChanges) {
        const stageResult = runGit(['add', '--', filePath])
        if (stageResult.status !== 0) {
            console.error(stageResult.stderr.trim() || `Unable to stage ${filePath}`)
            return false
        }
    }

    return true
}

/**
 * Process every selected source file without stopping after the first failure.
 *
 * @param {string[]} filePaths - Relative repository file paths.
 * @param {(filePath: string) => boolean} fileProcessor - File processing callback.
 * @returns {boolean} True when every file was processed successfully.
 */
export const processFiles = (filePaths, fileProcessor) => {
    let success = true
    filePaths.forEach(filePath => {
        if (!fileProcessor(filePath)) {
            success = false
        }
    })

    return success
}

/**
 * Parse command-line options for the header updater.
 *
 * @param {string[]} argumentsList - Process command-line arguments.
 * @returns {{checkOnly: boolean, stageChanges: boolean, filePaths: string[]}} Parsed options.
 */
export const parseArguments = argumentsList => {
    const options = {
        checkOnly: argumentsList.includes('--check'),
        filePaths: argumentsList.filter(argument => !argument.startsWith('--')),
        stageChanges: argumentsList.includes('--stage'),
    }

    return options
}

/**
 * Run the file-header update command.
 *
 * @param {string[]} argumentsList - Process command-line arguments.
 * @returns {number} Process exit code.
 */
export const main = argumentsList => {
    const options = parseArguments(argumentsList)
    const filePaths = argumentsList.includes('--staged') ? getStagedFiles() : options.filePaths
    const supportedFiles = filePaths.filter(isSupportedSourceFile)
    const unsynchronizedFiles = argumentsList.includes('--staged')
        ? supportedFiles.filter(filePath => !isWorktreeSynchronized(filePath))
        : []

    if (unsynchronizedFiles.length > 0) {
        console.error('Header update aborted because staged files also contain unstaged changes:')
        unsynchronizedFiles.forEach(filePath => console.error(`- ${filePath}`))
        return 1
    }

    const success = processFiles(supportedFiles, filePath => processFile(filePath, options.checkOnly, options.stageChanges))
    return success ? 0 : 1
}

if (import.meta.main) {
    process.exit(main(process.argv.slice(2)))
}
