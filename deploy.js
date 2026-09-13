/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: deploy.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-09-19
 * Last modified: 2026-09-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import argparse       from 'argparse'
import fs              from 'node:fs'
import path           from 'path'
import process        from 'node:process'
import { Deployment } from './deployment/Deployment.js'
import {createGitHubRelease} from './deployment/GitHubRelease.js'

// Keep the platform values centralized so CLI flags and deployment configuration
// always use the same identifiers.
const platforms = {production: 'production', staging: 'staging', test: 'test', nightly: 'nightly'}

/*******************************************************************************
 * Read/manage arguments
 */
const parser = new argparse.ArgumentParser(
    {
        description: 'LGS1920 products deployment script',
        usage:       'deploy --prod|-p, --staging|-s, --test|-t, --nightly|-n or --help|-h',
    },
)

parser.add_argument('--prod', '-p', {
    action: 'store_true',
    help:   'Deploy to production platform',
})

parser.add_argument('--staging', '-s', {
    action: 'store_true',
    help:   'Deploy to staging platform',
})

parser.add_argument('--test', '-t', {
    action: 'store_true',
    help:   'Deploy to test platform',
})

parser.add_argument('--nightly', '-n', {
    action: 'store_true',
    help:   'Deploy to nightly platform',
})

parser.add_argument('--ci', {
    action: 'store_true',
    help:   'Run without creating or pushing deployment Git tags',
})

parser.add_argument('--release', {
    action: 'store_true',
    help:   'Create a production GitHub Release instead of deploying locally',
})

parser.add_argument('--auto', {
    action: 'store_true',
    help:   'Publish a production GitHub Release immediately',
})

parser.add_argument('--release-tag', {
    help: 'Use an existing release tag in CI metadata',
})

parser.add_argument('--product', {
    help: 'Product to deploy when the worktree directory name is not studio or backend',
})
const args = parser.parse_args()

const directoryProduct = path.basename(process.cwd())
const detectedProduct = ['studio', 'backend'].includes(directoryProduct)
    ? directoryProduct
    : fs.existsSync(path.join(process.cwd(), 'public/version.json'))
        ? 'studio'
        : fs.existsSync(path.join(process.cwd(), 'version.json'))
            ? 'backend'
            : directoryProduct
const product = args.product || detectedProduct
const platform = args.prod
    ? platforms.production
    : args.staging
        ? platforms.staging
        : args.nightly
            ? platforms.nightly
            : platforms.test

if (!['studio', 'backend'].includes(product)) {
    throw new Error(`Unsupported product: ${product}. Use --product studio or --product backend`)
}

if (args.auto && (!args.release || !args.prod)) {
    throw new Error('--auto requires --prod --release')
}

if (args.release && !args.prod) {
    throw new Error('--release requires --prod')
}

if (args.release) {
    try {
        const release = createGitHubRelease({
            auto:   args.auto,
            product,
        })
        const state = release.draft ? 'draft created' : 'published'
        console.log(`GitHub Release ${state}: ${release.url}`)
        process.exit(0)
    }
    catch (error) {
        console.error(`GitHub Release creation failed: ${error.message}`)
        process.exit(1)
    }
}

const deployment = new Deployment(
    {
        ci:         args.ci,
        local:      path.dirname(process.cwd()),
        localProductRoot: process.cwd(),
        platform,
        product,
        releaseTag: args.releaseTag,
    })

deployment.done
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
