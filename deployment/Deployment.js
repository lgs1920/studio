/**********************************************************************************************************************
 *                                                                                                                    *
 * This file is part of the LGS1920/backend project.                                                                  *
 *                                                                                                                    *
 *                                                                                                                    *
 * File: Deployment.js                                                                                                *
 * Path: /home/christian/devs/assets/lgs1920/backend/deployment/Deployment.js                                         *
 *                                                                                                                    *
 * Author : Christian Denat                                                                                           *
 * email: christian.denat@orange.fr                                                                                   *
 *                                                                                                                    *
 * Created on: 2024-09-21                                                                                             *
 * Last modified: 2024-09-21                                                                                          *
 *                                                                                                                    *
 *                                                                                                                    *
 * Copyright © 2024 LGS1920                                                                                           *
 *                                                                                                                    *
 **********************************************************************************************************************/

import { exec, execSync } from 'child_process'
import path               from 'path'
import { Client as SCP }  from 'scp2'
import { Client as SSH2 } from 'ssh2'
import { zip }            from 'zip-a-folder'

const fs = require('fs')
const yaml = require('yaml')

/**
 * Class to manage the deployment of applications to different platforms such as production, staging, and test.
 */
export class Deployment {
    platforms = {production: 'production', staging: 'staging', test: 'test'}
    products = {studio: 'studio', backend: 'backend'}

    red = '\x1b[32m'
    green = '\x1b[32m'
    yellow = '\x1b[33m'
    reset = '\x1b[0m'

    constructor(params) {
        this.product = params.product
        this.platform = params.platform
        this.local = params.local
        this.configure().then(() => this.launch())
    }

    /**
     * Configure the dployment
     *
     * @return {Promise<void>}
     */
    configure = async () => {
        this.configuration = yaml.parse(fs.readFileSync('deployment/deploy.yml', 'utf8'))
        this.version = await this.getVersion()
        this.remoteUser = this.configuration.remote[this.platform].user
        this.remoteHost = this.configuration.remote[this.platform].host
        this.remotePath = `${this.configuration.remote[this.platform].path}/${this.platform}/${this.product}`
        this.remoteReleasePath = `${this.remotePath}/${this.configuration.remote.releases}`
        this.deploymentDir = 'deployment'

        this.dist = this.configuration.local.dist
        this.current = this.configuration.remote.current

        this.localDistPath = path.join(`${this.local}/${this.product}`, `./${this.dist}/${this.version}`)

        this.password = process.env[`LGS1920_PASSWORD_${this.platform.toUpperCase()}`]

        this.sshConfig = {
            host:     this.remoteHost,
            port:     22,
            username: this.remoteUser,
            password: this.password,
        }

        this.pm2 = this.configuration.backend[this.platform].pm2

    }

    /**
     * Get product version
     *
     * @return {Promise<string>}
     */
    getVersion = async () => {
        switch (this.product) {
            case 'studio': {
                const file = Bun.file('./public/version.json')
                return (await file.json()).studio
            }
            case 'backend': {
                const file = Bun.file('./version.json')
                return (await file.json()).backend
            }
        }
    }

    /**
     * Create a symbolic like to have a constant access to the app over the releases
     *
     * @param connection
     * @return {Promise<unknown>}
     */
    link = async (connection) => {
        return new Promise((resolve, reject) => {
            console.log('--- Create Link...')
            connection.exec(`ln -sfn ${this.remoteReleasePath}/${this.version} ${this.remotePath}/${this.current} && rm ${this.remoteReleasePath}/${this.version}.zip`, (err, stream) => {
                if (err) {
                    console.error(err)
                    reject(err)
                    return
                }
                stream.on('close', () => {
                    console.log(`\n    ${this.green}Deployment done.${this.reset}\n`)
                    resolve()
                }).on('data', (data) => {
                    // handle data
                }).stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`)
                })
            })
        })
    }

    /**
     * Unzip the release on the remote server
     *
     * @param connection
     * @return {Promise<unknown>}
     */
    unzip = async (connection) => {

        console.log(`    > Unzipping release on ${this.platform}`)


        return new Promise((resolve, reject) => {
            connection.exec(`unzip -o ${this.remoteReleasePath}/${this.version}.zip -d ${this.remoteReleasePath}/${this.version}`, (err, stream) => {
                if (err) {
                    console.error(err)
                    reject(err)
                    return
                }
                stream.on('close', () => {
                    console.log(`    > ${this.green}Unzip done.${this.reset}`)
                    resolve()
                }).on('data', (data) => {
                    // handle data
                }).stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`)
                })
            })
        })
    }

    /**
     * Handle post-deployment tasks
     *
     * @param {Object} connection - The connection object used to execute the post-deployment command.
     * @returns {Promise<void>} - A promise that resolves when the post-deployment tasks are completed.
     */
    postDeployment = async (connection) => {

        console.log('--- Post deployment')

        if (this.product !== this.products.backend) {
            return
        }
        return new Promise((resolve, reject) => {
            connection.exec(this.configuration.backend[this.platform].pm2.command, (err, stream) => {
                if (err) {
                    console.error(err)
                    reject(err)
                    return
                }
                stream.on('close', () => {
                    console.log(`    > ${this.green}backend restarted.${this.reset}`)
                    resolve()
                }).on('data', (data) => {
                    // handle data
                }).stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`)
                })
            })
        })
    }

    /**
     * Build the app
     *
     * @return {Promise<unknown>}
     */
    build = async () => {

        // remove same version if it exists
        execSync(`rm -rf ${this.localDistPath}`)

        return new Promise((resolve, reject) => {
            console.log(`--- Building ${this.yellow}${this.product} ${this.version}${this.reset} for ${this.platform} ...`)
            let buildCommand
            switch (this.product) {
                case 'studio': {
                    buildCommand = `bun run build`
                    break
                }
                case 'backend': {
                    const minify = this.platform === 'production' ? '-m' : ''
                    buildCommand = `bun build.js ${minify} -v=${this.version}`
                    break
                }
            }
            exec(buildCommand, (error) => {
                if (error) {
                    console.error(err)
                    reject(`${this.red}Build error: ${error.message}${this.reset}`)
                    return
                }
                console.log(`    > ${this.green}Build completed on ${this.localDistPath}.${this.reset}`)
                console.log('')

                resolve()
            })
        })
    }

    /**
     * Compress the app
     *
     * @return {Promise<unknown>}
     */
    zip = async () => {
        return new Promise(async (resolve, reject) => {
            console.log(`    > Zipping version`)
            try {
                await zip(this.localDistPath, `${this.localDistPath}.zip`)
                console.log(`    > ${this.green}Version zipped${this.reset}`)
                resolve()
            }
            catch (error) {
                console.error(err)
                reject(`${this.red}Zip failed: ${error.message}${this.reset}`)
            }
        })
    }

    /**
     * Copy the zipped app to the deployment server
     *
     * @return {Promise<unknown>}
     */
    copy = async () => {
        return new Promise((resolve, reject) => {
            const scp = new SCP(this.sshConfig)
            scp.upload(`${this.localDistPath}.zip`, this.remoteReleasePath, (err) => {
                if (err) {
                    console.error(err)
                    reject(`Error during file copy:`, err)
                    return
                }
                console.log(`    > File copied ${this.green}successfully${this.reset}`)
                scp.close()
                resolve()
            })
        })
    }

    /**
     * Handle som pre deployment (after the build) tasks
     *
     * @return {Promise<void>}
     */
    preDeployment = async () => {
        console.log('--- Pre deployment')
        console.log('    > Preparing files')
        switch (this.product) {
            case 'studio': {
            }
                break
            case 'backend': {
                // add PM2 config
                execSync(`cp -f ${this.deploymentDir}/pm2-config/${this.pm2.config} ${this.localDistPath}/ecosystem.config.js`)

                // Add version.json and rename index to backend
                execSync(`cp -f version.json ${this.localDistPath} && mv ${this.localDistPath}/index.js ${this.localDistPath}/backend.js`)
            }
        }

        // Build the post deployment launch command
        const where = path.join(this.configuration.remote[this.platform].path,this.platform,'backend',this.current)
        this.configuration.backend[this.platform].pm2.command = `cd ${where} && ${this.pm2.bin} start  --cwd ${where} ecosystem.config.js  &&  ${this.pm2.bin} save`

        //configure servers home
        this.configuration.backend[this.platform].home=path.join(
            this.configuration.remote[this.platforms.production].path,
            this.platform,
            'backend',
            this.configuration.remote.current
        )

        this.configuration.studio[this.platform].home=path.join(
            this.configuration.remote[this.platforms.production].path,
            this.platform,
            'studio',
            this.configuration.remote.current
        )

        // We save servers configuration in servers.yml
        fs.writeFileSync(`${this.localDistPath}/servers.json`, JSON.stringify({
                                                                                 platform:this.platform,
                                                                                 backend: this.configuration.backend[this.platform],
                                                                                 studio:  this.configuration.studio[this.platform],
                                                                             }), 'utf8')


        // We zip the distrib
        await this.zip()
        console.log('')

    }

    /**
     * Asynchronously initiates the deployment process.
     *
     * This function performs several sequential steps to build, pre-deploy, copy,
     * and deploy an application to a remote server through an SSH connection.
     *
     * Steps involved:
     * 1. Builds the application.
     * 2. Runs pre-deployment tasks.
     * 3. Logs the start of the deployment.
     * 4. Copies necessary files.
     * 5. Establishes an SSH connection to the remote server.
     * 6. Unzips the package on the remote server.
     * 7. Executes the deployment.
     * 8. Runs post-deployment tasks.
     * 9. Logs the success of the deployment.
     *
     * If any step in the process fails, it logs the error and terminates the process.
     */

    launch = async () => {
        try {
            await this.build()

            await this.preDeployment()

            console.log(`--- Starting deployment of ${this.yellow}${this.localDistPath}.zip${this.reset} to ${this.yellow}${this.remoteReleasePath}${this.reset}`)
            await this.copy()
            const connection = new SSH2()
            connection.on('ready', async () => {
                console.log('    > SSH connection established.')

                try {
                    await this.unzip(connection)

                    console.log('    > Deploying release...')
                    await this.link(connection)
                    await this.postDeployment(connection)

                    console.log('\n---')
                    console.log(`${this.yellow}Application ${this.green}${this.product} ${this.version}${this.yellow} deployed to ${this.platform} ${this.reset}`)
                    console.log('---\n')

                }
                catch (error) {
                    console.error(`Error during deployment: ${error}`)
                }
                finally {
                    connection.end()
                }
            }).connect(this.sshConfig)
        }
        catch (error) {
            console.error(`Error: ${error}`)
        }
    }
}