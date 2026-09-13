/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GitHubRelease.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-13
 * Last modified: 2026-09-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Build the GitHub CLI arguments used to create a product release.
 *
 * @param {object} options Release options.
 * @param {string} options.tag Release tag.
 * @param {string} options.target Commit SHA or branch targeted by the release.
 * @param {string} options.title Release title.
 * @param {boolean} [options.auto=false] Publish the pre-release immediately.
 * @returns {string[]} GitHub CLI arguments.
 */
export const buildGitHubReleaseArguments = ({tag, target, title, auto = false} = {}) => {
    if (!tag || !target || !title) {
        throw new TypeError('GitHub release options are incomplete')
    }

    const argumentsList = [
        'release',
        'create',
        tag,
        '--target',
        target,
        '--title',
        title,
        '--generate-notes',
    ]

    if (auto) {
        argumentsList.push('--prerelease')
    }
    else {
        argumentsList.push('--draft')
    }

    return argumentsList
}

/**
 * Read a product version from its version metadata file.
 *
 * @param {string} product Product name.
 * @param {string} root Repository root.
 * @returns {string} Product version.
 */
export const readProductVersion = (product, root = process.cwd()) => {
    const versionPath = product === 'backend'
        ? path.join(root, 'version.json')
        : path.join(root, 'public/version.json')
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'))
    const version = versionData[product]

    if (!version) {
        throw new Error(`Version is missing for product ${product}`)
    }

    return version
}

/**
 * Create a GitHub Release for a product.
 *
 * Without auto mode the release remains a draft and its URL can be reviewed
 * before publication. Publishing the release is what triggers production
 * deployment.
 *
 * @param {object} options Release options.
 * @param {string} options.product Product name.
 * @param {string} [options.root=process.cwd()] Repository root.
 * @param {boolean} [options.auto=false] Publish the release immediately.
 * @param {string} [options.target] Commit SHA or branch targeted by the release.
 * @param {string} [options.ghBin='gh'] GitHub CLI executable.
 * @param {Function} [options.runCommand=execFileSync] Command runner.
 * @returns {{tag: string, url: string, draft: boolean}} Created release metadata.
 */
export const createGitHubRelease = ({
    product,
    root = process.cwd(),
    auto = false,
    target,
    ghBin = 'gh',
    runCommand = execFileSync,
} = {}) => {
    if (!product) {
        throw new TypeError('GitHub release product is required')
    }

    const workingTree = runCommand('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim()
    if (workingTree) {
        throw new Error('GitHub release requires a clean working tree')
    }

    const resolvedTarget = target || runCommand('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim()
    const version = readProductVersion(product, root)
    const tag = `v${version}`
    const title = `LGS1920 ${product} ${tag}`
    const argumentsList = buildGitHubReleaseArguments({
        tag,
        target: resolvedTarget,
        title,
        auto,
    })
    const output = runCommand(ghBin, argumentsList, {cwd: root, encoding: 'utf8'}).trim()
    const url = output.split(/\r?\n/).filter(Boolean).at(-1)

    if (!url) {
        throw new Error('GitHub release URL is missing from gh output')
    }

    return {tag, url, draft: !auto}
}
