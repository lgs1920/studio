
/**********************************************************************************************************************
 *                                                                                                                    *
 * This file is part of the LGS1920/backend project.                                                                  *
 *                                                                                                                    *
 *                                                                                                                    *
 * File: deploy.js                                                                                                    *
 * Path: /home/christian/devs/assets/lgs1920/backend/deploy.js                                                        *
 *                                                                                                                    *
 * Author : Christian Denat                                                                                           *
 * email: christian.denat@orange.fr                                                                                   *
 *                                                                                                                    *
 * Created on: 2024-09-18                                                                                             *
 * Last modified: 2024-09-18                                                                                          *
 *                                                                                                                    *
 *                                                                                                                    *
 * Copyright © 2024 LGS1920                                                                                           *
 *                                                                                                                    *
 **********************************************************************************************************************/

import argparse           from 'argparse'
import { exec }           from 'child_process'
import path               from 'path'
import { Client as SCP }  from 'scp2'
import { Client as SSH2 } from 'ssh2'
import { zip }            from 'zip-a-folder'

// Argument parser setup
const parser = new argparse.ArgumentParser({
                                               description: 'Deployment script',
                                           })

// Get arguments
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

// Determine environment based on arguments
const ENV_PREFIX = args.prod ? 'PROD_'
                             : args.staging ? 'STAGING_'
                                            : args.test ? 'TEST_' : null

if (!ENV_PREFIX) {
    console.error('Please specify --prod,-p, --staging,-s or --test,-t')
    process.exit(1)
}

// Define used constants from env and env file
const REMOTE_USER = import.meta.env[`${ENV_PREFIX}REMOTE_USER`]
const REMOTE_HOST = import.meta.env[`${ENV_PREFIX}REMOTE_HOST`]
const REMOTE_PATH = import.meta.env[`${ENV_PREFIX}REMOTE_HOME`]
const REMOTE_RELEASE_PATH = REMOTE_PATH + import.meta.env.RELEASES
const PRODUCT = import.meta.env.LGS1920_PRODUCT

// Read Version for each product
let VERSION
switch (PRODUCT) {
    case 'studio': {
        const file = Bun.file('./public/version.json');
        VERSION = (await file.json()).studio
        break
    }
    case 'backend': {
        const file = Bun.file('./version.json');
        VERSION = (await file.json()).backend
        break
    }
}

const PLATFORM = args.prod ? 'production' : args.staging ? 'staging' : 'test'
const DIST = import.meta.env.DIST
const CURRENT = import.meta.env.CURRENT
const LOCAL_DIST_PATH = path.join(`${path.dirname(__dirname)}/${PRODUCT}`, `./${DIST}/${VERSION}`)

const PASSWORD = process.env[`LGS1920_PASSWORD_${ENV_PREFIX.slice(0, -1)}`]
//const KEYSTORE =  process.env[`LGS1920_KEYSTORE_${ENV_PREFIX.slice(0, -1)}`];
//const PASSPHRASE =  process.env[`LGS1920_PASSPHRASE_${ENV_PREFIX.slice(0, -1)}`];

const RED = '\x1b[32m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

const config = {
    host:     REMOTE_HOST,
    port:     22,
    username: REMOTE_USER,
    password: PASSWORD,
    // privatekey: require('fs').readFileSync(`${KEYSTORE}`),
    // passphrase: PASSPHRASE,
}

// Function to create a symbolic link to the new release
const link = (connection) => {
    return new Promise((resolve, reject) => {
        console.log('Pre deployment...')
        connection.exec(`ln -sfn ${REMOTE_RELEASE_PATH}/${VERSION} ${REMOTE_PATH}/${CURRENT} && rm ${REMOTE_RELEASE_PATH}/${VERSION}.zip`, (err, stream) => {
            if (err) {
                reject(err)
                return
            }
            stream.on('close', (code, signal) => {
                console.log(`${GREEN}Deployment done.${RESET}`)
                resolve()
            }).on('data', (data) => {
                // console.log(`STDOUT: ${data}`);
            }).stderr.on('data', (data) => {
                console.error(`STDERR: ${data}`)
            })
        })
    })
}

// Function to unzip the release on the remote server
const unzip = (connection) => {
    return new Promise((resolve, reject) => {
        connection.exec(`unzip -o ${REMOTE_RELEASE_PATH}/${VERSION}.zip -d ${REMOTE_RELEASE_PATH}/${VERSION}`, (err, stream) => {
            if (err) {
                reject(err)
                return
            }
            stream.on('close', (code, signal) => {
                console.log(`${GREEN}Unzip done.${RESET}`)
                resolve()
            }).on('data', (data) => {
                // console.log(`STDOUT: ${data}`);
            }).stderr.on('data', (data) => {
                console.error(`STDERR: ${data}`)
            })
        })
    })
}

// Function to build the project
const build = () => {
    return new Promise((resolve, reject) => {
        console.log(`Building ${YELLOW}${PRODUCT} ${VERSION}${RESET} for ${PLATFORM} ...`)

        let BUILD_COMMAND
        switch (PRODUCT) {
            case 'studio': {
                BUILD_COMMAND = `NODE_ENV=${PLATFORM}  bunx --bun vite build --mode ${PLATFORM}`
                break
            }
            case 'backend': {
                const minify=PLATFORM==='production'?'-m':''
                BUILD_COMMAND =`NODE_ENV=${PLATFORM}  bun build.js ${minify} -v=${VERSION}`
                break
            }
        }

        exec(BUILD_COMMAND, (error, stdout, stderr) => {
            if (error) {
                reject(`${RED}Build error: ${error.message}${RESET}`)
                return
            }
            console.log(`${GREEN}Build completed on ${LOCAL_DIST_PATH}.${RESET}`)
            resolve()
        })
    })
}

// Function to zip the built project
const zipVersion = () => {
    return new Promise(async (resolve, reject) => {
        console.log(`Zipping version`)
        try {
            await zip(LOCAL_DIST_PATH, `${LOCAL_DIST_PATH}.zip`)
            console.log(`${GREEN}Version zipped${RESET}`)
            resolve()
        }
        catch (error) {
            reject(`${RED}Zip failed: ${error.message}${RESET}`)
        }
    })
}

// Function to copy the zipped file to the remote server
const copy = () => {
    return new Promise((resolve, reject) => {
        console.log(`Starting deployment of ${YELLOW}${LOCAL_DIST_PATH}.zip${RESET} to ${YELLOW}${REMOTE_RELEASE_PATH}${RESET}`)
        const scp = new SCP(config)
        scp.upload(`${LOCAL_DIST_PATH}.zip`, REMOTE_RELEASE_PATH, (err) => {
            if (err) {
                reject('${RED}Error during file copy:${RESET}', err)
                return
            }
            console.log(`File copied ${GREEN}successfully${RESET}`)
            scp.close()
            resolve()
        })
    })
}

// Main function to orchestrate the deployment process
const main = async () => {

    try {
        await build()
        await zipVersion()
        await copy()

        const connection = new SSH2()
        connection.on('ready', async () => {
            console.log('SSH connection established.')

            try {
                console.log('Unzipping release...')
                await unzip(connection)

                console.log('Deploying release...')
                await link(connection)

                console.log(`${YELLOW}Application ${GREEN}${PRODUCT} ${VERSION}${YELLOW} deployed to ${PLATFORM} ${RESET}`)
            }
            catch (error) {
                console.error(`Error during deployment: ${error}`)
            }
            finally {
                connection.end()
            }
        }).connect(config)
    }
    catch (error) {
        console.error(`Error: ${error}`)
    }
}

main()