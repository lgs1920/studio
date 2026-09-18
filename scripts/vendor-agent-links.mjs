#!/usr/bin/env bun
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: vendor-agent-links.mjs
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-18
 * Last modified: 2026-09-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {dirname, isAbsolute, join, relative, resolve} from 'node:path'
import process from 'node:process'

const repositoryRoot = resolve(import.meta.dirname, '..')
const configurationPath = join(repositoryRoot, '.agent-links.json')
const statePath = join(repositoryRoot, '.git', 'lgs1920-agent-links.json')

/**
 * Read the repository paths that may use development-only guidance links.
 *
 * @returns {{managedPaths: string[]}} Guidance link configuration.
 */
const readConfiguration = () => {
    if (!existsSync(configurationPath)) return {managedPaths: []}

    const configuration = JSON.parse(readFileSync(configurationPath, 'utf8'))
    return {managedPaths: configuration.managedPaths ?? []}
}

/**
 * Run a Git command in the current repository.
 *
 * @param {string[]} argumentsList Git arguments.
 * @returns {string} Git command output.
 */
const runGit = argumentsList => execFileSync('git', ['-C', repositoryRoot, ...argumentsList], {encoding: 'utf8'})

/**
 * List tracked paths below a guidance path.
 *
 * @param {string} pathSpec Guidance path or directory.
 * @returns {string[]} Tracked paths.
 */
const getTrackedPaths = pathSpec => runGit(['ls-files', '-z', '--', pathSpec])
    .split('\0')
    .filter(Boolean)

/**
 * Find configured guidance paths that are symbolic links in the checkout.
 *
 * @returns {{pathValue: string, absolutePath: string, linkTarget: string, sourcePath: string}[]} Active external guidance links.
 */
const getManagedLinks = () => readConfiguration().managedPaths
    .map(readManagedLink)
    .filter(link => link !== null)
    .filter(({sourcePath}) => !isRepositoryPath(sourcePath))

/**
 * Persist link information between the pre-commit and post-commit hooks.
 *
 * @param {object[]} links Active guidance links.
 * @returns {void}
 */
const writeState = links => {
    mkdirSync(dirname(statePath), {recursive: true})
    writeFileSync(statePath, `${JSON.stringify({links}, null, 2)}\n`)
}

/**
 * Read link information saved by the prepare step.
 *
 * @returns {object[]} Saved guidance links.
 */
const readState = () => {
    if (!existsSync(statePath)) return []
    return JSON.parse(readFileSync(statePath, 'utf8')).links ?? []
}

/**
 * Check whether a resolved link target is inside this repository.
 *
 * @param {string} absolutePath Resolved filesystem path.
 * @returns {boolean} Whether the path belongs to this repository.
 */
const isRepositoryPath = absolutePath => {
    const relativePath = relative(repositoryRoot, absolutePath)
    return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

/**
 * Resolve a symbolic link target from a configured repository path.
 *
 * @param {string} pathValue Repository-relative symbolic link path.
 * @returns {{pathValue: string, absolutePath: string, linkTarget: string, sourcePath: string} | null} Link details.
 */
const readManagedLink = pathValue => {
    const absolutePath = join(repositoryRoot, pathValue)
    if (!existsSync(absolutePath) || !lstatSync(absolutePath).isSymbolicLink()) return null

    const linkTarget = readlinkSync(absolutePath)
    const sourcePath = isAbsolute(linkTarget)
        ? linkTarget
        : resolve(dirname(absolutePath), linkTarget)

    return {pathValue, absolutePath, linkTarget, sourcePath}
}

/**
 * Remove a file, directory, or symbolic link without following the link.
 *
 * @param {string} absolutePath Path to remove.
 * @returns {void}
 */
const removePath = absolutePath => rmSync(absolutePath, {force: true, recursive: true})

/**
 * Replace development-only links with physical files and stage them.
 *
 * @returns {void}
 */
const materialize = () => {
    const links = getManagedLinks().map(({pathValue, linkTarget, sourcePath}) => {
        if (!existsSync(sourcePath)) {
            throw new Error(`Guidance link target does not exist: ${pathValue} -> ${linkTarget}`)
        }

        const linkType = lstatSync(sourcePath).isDirectory() ? 'junction' : 'file'
        return {pathValue, linkTarget, sourcePath, linkType}
    })

    if (links.length === 0) return

    writeState(links)

    try {
        for (const {pathValue, sourcePath} of links) {
            const absolutePath = join(repositoryRoot, pathValue)
            const trackedPaths = getTrackedPaths(pathValue)
            if (trackedPaths.length > 0) runGit(['update-index', '--no-skip-worktree', '--', ...trackedPaths])

            removePath(absolutePath)
            cpSync(sourcePath, absolutePath, {recursive: true, dereference: true})
            runGit(['add', '-A', '-f', '--', pathValue])
        }
    }
    catch (error) {
        restore()
        throw error
    }
}

/**
 * Restore development-only links after a successful commit.
 *
 * @returns {void}
 */
const restore = () => {
    const links = readState()
    if (links.length === 0) return

    for (const {pathValue, linkTarget, linkType} of links) {
        const absolutePath = join(repositoryRoot, pathValue)
        removePath(absolutePath)
        symlinkSync(linkTarget, absolutePath, linkType)

        const trackedPaths = getTrackedPaths(pathValue)
        if (trackedPaths.length > 0) runGit(['update-index', '--skip-worktree', '--', ...trackedPaths])
    }

    rmSync(statePath, {force: true})
}

/**
 * Ensure managed guidance links are absent from the staged tree.
 *
 * @returns {void}
 */
const check = () => {
    const symlinkEntries = runGit(['ls-files', '-s', '--'])
        .split('\n')
        .filter(line => line.startsWith('120000 '))
        .map(line => line.slice(line.indexOf('\t') + 1))
    const managedPaths = new Set(readConfiguration().managedPaths)
    const unexpectedPaths = symlinkEntries.filter(pathValue => {
        if (!managedPaths.has(pathValue)) return false

        const linkTarget = runGit(['show', `:${pathValue}`]).trim()
        const absolutePath = join(repositoryRoot, pathValue)
        const sourcePath = isAbsolute(linkTarget)
            ? linkTarget
            : resolve(dirname(absolutePath), linkTarget)

        return !isRepositoryPath(sourcePath)
    })

    if (unexpectedPaths.length > 0) {
        throw new Error(`Guidance links are still staged: ${unexpectedPaths.join(', ')}`)
    }
}

const command = process.argv[2] ?? 'check'
if (command === 'prepare') materialize()
else if (command === 'restore') restore()
else if (command === 'check') check()
else throw new Error(`Unknown command: ${command}`)
