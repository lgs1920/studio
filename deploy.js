/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: deploy.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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

const platforms = {production: 'production', staging: 'staging', test: 'test'}

/*******************************************************************************
 * Read/manage arguments
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
const deployment = new Deployment(
    {
        local:    path.dirname(process.cwd()),
        platform: args.prod ? platforms.production : args.staging ? platforms.staging : platforms.test,
        product:  path.basename(process.cwd()),
    })

deployment.done
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
