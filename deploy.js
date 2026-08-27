/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: deploy.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import argparse       from 'argparse'
import path           from 'path'
import process        from 'node:process'
import { Deployment } from './deployment/Deployment.js'

// Keep the platform values centralized so CLI flags and deployment configuration
// always use the same identifiers.
const platforms = {production: 'production', staging: 'staging', test: 'test'}

/*******************************************************************************
 * Parse command-line arguments
 */
const parser = new argparse.ArgumentParser(
    {
        description: 'LGS1920 products deployment script',
        usage:       'deploy --prod|-p, --staging|-s, --test|-t or --help|-h',
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
const args = parser.parse_args()

// The product is inferred by Deployment from the current directory name.
// When no platform flag is provided, the script intentionally falls back to test.
const deployment = new Deployment(
    {
        local:    path.dirname(process.cwd()),
        platform: args.prod ? platforms.production : args.staging ? platforms.staging : platforms.test,
        product:  path.basename(process.cwd()),
    })

// Deployment exposes a promise so the CLI exits with a meaningful status code:
// zero for success and one for any build, transfer, or remote deployment error.
deployment.done
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
