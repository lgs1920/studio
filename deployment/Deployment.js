/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Deployment.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-07
 * Last modified: 2025-07-07
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

// Import required Node.js modules for process execution, file system operations, and Git interactions
import { exec, execSync } from 'child_process'
import path               from 'path'
import { Client as SCP }  from 'scp2'
import { simpleGit }      from 'simple-git'
import { Client as SSH2 } from 'ssh2'
import { zip }            from 'zip-a-folder'

const fs = require('fs')
const yaml = require('yaml')

/**
 * Class to manage the deployment of applications to different platforms such as production, staging, and test.
 * Handles building, zipping, copying, and deploying the application, along with Git tag management.
 */
export class Deployment {
    // Define supported platforms and products
    platforms = {production: 'production', staging: 'staging', test: 'test'}
    products = {studio: 'studio', backend: 'backend'}

    // ANSI color codes for console output formatting
    red = '\x1b[31m'
    green = '\x1b[32m'
    yellow = '\x1b[33m'
    reset = '\x1b[0m'

    /**
     * Creates a new Deployment instance and initiates the configuration process.
     * @param {Object} params - Deployment parameters.
     * @param {string} params.product - The product to deploy ('studio' or 'backend').
     * @param {string} params.platform - The target platform ('production', 'staging', or 'test').
     * @param {string} params.local - The local base path for the deployment files.
     */
    constructor(params) {
        this.product = params.product
        this.platform = params.platform
        this.local = params.local
        this.configure().then(() => this.launch())
    }

    /**
     * Configures the deployment by loading settings from a YAML file and initializing Git and SSH configurations.
     * @returns {Promise<void>} Resolves when configuration is complete.
     */
    configure = async () => {
        // Parse deployment configuration from YAML file
        this.configuration = yaml.parse(fs.readFileSync('deployment/deploy.yml', 'utf8'))
        this.version = await this.getVersion()
        this.remoteUser = this.configuration.remote[this.platform].user
        this.remoteHost = this.configuration.remote[this.platform].host
        this.remotePath = `${this.configuration.remote[this.platform].path}/${this.platform}/${this.product}`
        this.remoteReleasePath = `${this.remotePath}/${this.configuration.remote.releases}`
        this.deploymentDir = 'deployment'

        // Set local and remote paths
        this.dist = this.configuration.local.dist
        this.current = this.configuration.remote.current
        this.localDistPath = path.join(`${this.local}/${this.product}`, `./${this.dist}/${this.version}`)

        // Load environment variables for authentication
        this.password = process.env[`LGS1920_PASSWORD_${this.platform.toUpperCase()}`]
        this.github_token = process.env[`LGS1920_GITHUB_TOKEN`]
        this.github_user = process.env[`LGS1920_GITHUB_USER`]

        // Initialize Git with authentication
        this.git = simpleGit({
                                 config: [
                                     `http.extraHeader=Authorization: ${this.github_token}`,
                                 ],
                             })

        // Configure SSH connection settings
        this.sshConfig = {
            host: this.remoteHost,
            port: 22,
            username: this.remoteUser,
            password: this.password,
        }

        // Load PM2 configuration for backend
        this.pm2 = this.configuration.backend[this.platform].pm2

        // Generate timestamp for tag naming
        this.date = new Date().toISOString()
            .replace(/[-:.]/g, '')
            .slice(0, 15)

        // Get current Git branch
        this.branch = (await this.git.status()).current
    }

    /**
     * Retrieves the version of the product from a JSON file.
     * @returns {Promise<string>} The version string for the specified product.
     */
    getVersion = async () => {
        switch (this.product) {
            case 'studio': {
                // eslint-disable-next-line no-undef
                const file = Bun.file('./public/version.json')
                return (await file.json()).studio
            }
            case 'backend': {
                // eslint-disable-next-line no-undef
                const file = Bun.file('./version.json')
                return (await file.json()).backend
            }
        }
    }

    /**
     * Creates a symbolic link on the remote server to maintain consistent app access across releases.
     * @param {Object} connection - The SSH2 connection object.
     * @returns {Promise<void>} Resolves when the symbolic link is created and the zip file is removed.
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
                    // Handle stdout data (if needed)
                }).stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`)
                })
            })
        })
    }

    /**
     * Unzips the release package on the remote server.
     * @param {Object} connection - The SSH2 connection object.
     * @returns {Promise<void>} Resolves when the unzip operation is complete.
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
                    // Handle stdout data (if needed)
                }).stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`)
                })
            })
        })
    }

    /**
     * Handles post-deployment tasks, such as restarting the backend using PM2.
     * @param {Object} connection - The SSH2 connection object.
     * @returns {Promise<void>} Resolves when post-deployment tasks are complete.
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
                    // Handle stdout data (if needed)
                }).stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`)
                })
            })
        })
    }

    /**
     * Builds the application based on the product type.
     * @returns {Promise<void>} Resolves when the build is complete, rejects on build errors.
     */
    build = async () => {
        // Remove existing version directory if it exists
        execSync(`rm -rf ${this.localDistPath}`)
        return new Promise((resolve, reject) => {
            console.log(`--- Building ${this.yellow}${this.product} (version: ${this.version} - branch ${this.branch}) ${this.reset} for ${this.platform} ...`)
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
                    console.error(error)
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
     * Compresses the built application into a zip file.
     * @returns {Promise<void>} Resolves when the zip operation is complete, rejects on zip errors.
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
                console.error(error)
                reject(`Zip failed: ${error.message}`)
            }
        })
    }

    /**
     * Copies the zipped application to the remote server using SCP.
     * @returns {Promise<void>} Resolves when the file is copied, rejects on copy errors.
     */
    copy = async () => {
        return new Promise((resolve, reject) => {
            const scp = new SCP(this.sshConfig)
            scp.upload(`${this.localDistPath}.zip`, this.remoteReleasePath, (err) => {
                if (err) {
                    console.error(err)
                    reject(`Error during file copy: ${err}`)
                    return
                }
                console.log(`    > File copied ${this.green}successfully${this.reset}`)
                scp.close()
                resolve()
            })
        })
    }

    /**
     * Retrieves the specified Git remote.
     * @param {string} [target='origin'] - The name of the remote to retrieve.
     * @returns {Promise<Object>} The remote object if found.
     * @throws {Error} If the remote cannot be retrieved.
     */
    remote = async (target = 'origin') => {
        try {
            const remotes = await this.git.getRemotes(true)
            return remotes.find(remote => remote.name === target)
        }
        catch (error) {
            console.error('Error, cannot find remotes:', error)
            process.exit(1)
        }
    }

    /**
     * Creates a Git tag locally for the deployment.
     * Tag format: <platform>-<version>-<branch>-<date>
     * Commit message: 'Branch <branch> deployed on <tagName>!'
     * @returns {Promise<void>} Resolves when the tag is created.
     */
    gitTag = async () => {
        this.tagName = `${this.platform}-${this.version}-${this.branch}-${this.date}`
        const message = `Branch ${this.branch} deployed on ${this.tagName}!`
        console.log(`    > git commit tag : ${this.tagName}`)
        await this.git.commit(message)
        await this.git.addTag(this.tagName)
    }

    /**
     * Pushes the Git tag and branch to the remote repository.
     * @returns {Promise<void>} Resolves when the tag and branch are pushed.
     */
    pushTag = async () => {
        console.log(`    > Git push tag on branch ${this.branch}`)
        await this.git.push('origin', this.branch)
        await this.git.pushTags('origin')
        console.log(`    > ${this.green}Tag ${this.tagName} pushed to remote repository${this.reset}`)
    }

    /**
     * Deletes the Git tag locally and remotely.
     * @returns {Promise<void>} Resolves when the tag is deleted, logs errors if deletion fails.
     */
    deleteTag = async () => {
        console.log(`    > Deleting git tag : ${this.tagName}`)
        try {
            await this.git.removeTag(this.tagName)
            await this.git.push('origin', `:${this.tagName}`)
            console.log(`    > ${this.green}Tag ${this.tagName} deleted locally and remotely${this.reset}`)
        }
        catch (error) {
            console.error(`    > ${this.red}Failed to delete tag ${this.tagName}: ${error.message}${this.reset}`)
        }
    }

    /**
     * Handles pre-deployment tasks, such as creating a Git tag and preparing files for deployment.
     * @returns {Promise<void>} Resolves when pre-deployment tasks are complete.
     */
    preDeployment = async () => {
        console.log('--- Pre deployment')
        // Create Git tag locally
        await this.gitTag()
        console.log('    > Preparing files')
        switch (this.product) {
            case 'studio': {
                break
            }
            case 'backend': {
                // Copy PM2 configuration
                execSync(`cp -f ${this.deploymentDir}/pm2-config/${this.pm2.config} ${this.localDistPath}/ecosystem.config.js`)
                // Copy version.json and rename index.js to backend.js
                execSync(`cp -f version.json ${this.localDistPath} && mv ${this.localDistPath}/index.js ${this.localDistPath}/backend.js`)
            }
        }
        // Build the post-deployment launch command for PM2
        const where = path.join(this.configuration.remote[this.platform].path, this.platform, 'backend', this.current)
        this.configuration.backend[this.platform].pm2.command = `cd ${where} && ${this.pm2.bin} start --cwd ${where} ecosystem.config.js && ${this.pm2.bin} save`
        // Configure server home paths
        this.configuration.backend[this.platform].home = path.join(
            this.configuration.remote[this.platforms.production].path,
            this.platform,
            'backend',
            this.configuration.remote.current
        )
        this.configuration.studio[this.platform].home = path.join(
            this.configuration.remote[this.platforms.production].path,
            this.platform,
            'studio',
            this.configuration.remote.current
        )
        // Save server configuration to servers.json
        fs.writeFileSync(`${this.localDistPath}/servers.json`, JSON.stringify({
                                                                                  platform: this.platform,
                                                                                  backend:  this.configuration.backend[this.platform],
                                                                                  studio:   this.configuration.studio[this.platform],
                                                                                  site: this.configuration.site[this.platform],
                                                                              }), 'utf8')
        // Save build date to build.json
        fs.writeFileSync(`${this.localDistPath}/build.json`, JSON.stringify({date: Date.now()}))
        // Zip the distribution
        await this.zip()
    }

    /**
     * Asynchronously initiates the deployment process.
     * Steps include building, pre-deployment, copying, unzipping, linking, and post-deployment.
     * The Git tag is pushed only if all steps succeed; otherwise, it is deleted.
     * @returns {Promise<void>} Resolves when the deployment is complete, handles errors by deleting the tag.
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
                    await this.pushTag()
                    console.log('\n---')
                    console.log(`${this.yellow}Application ${this.green}${this.product} (version: ${this.version} - branch ${this.branch}) ${this.yellow} deployed to ${this.platform} ${this.reset}`)
                    console.log('---\n')
                }
                catch (error) {
                    console.error(`Error during deployment: ${error}`)
                    await this.deleteTag()
                }
                finally {
                    connection.end()
                }
            }).connect(this.sshConfig)
        }
        catch (error) {
            console.error(`Error: ${error}`)
            await this.deleteTag()
        }
    }
}