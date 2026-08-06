/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Deployment.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-07
 * Last modified: 2026-03-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

// Import required Node.js modules for process execution, file system operations, and Git/SSH interactions
import { exec, execSync, spawn } from 'node:child_process'
import fs                        from 'node:fs'
import path                      from 'node:path'
import process                   from 'node:process'
import { simpleGit }             from 'simple-git'
import { Client as SSH2 }        from 'ssh2'
import { parse as parseYaml }    from 'yaml'
import { zip }                   from 'zip-a-folder'
import {
    createBackendEnvironmentContent,
    createBackendEnvironmentPaths,
    createBackendPm2Command,
    quoteShellArgument,
} from './DeploymentCommands.js'

const STUDIO_APP_NAME = 'LGS1920 Studio Development'
const STUDIO_HTACCESS_CONTENT = `<IfModule mod_headers.c>
    <FilesMatch ".+-[A-Za-z0-9_-]{8,}\\.(css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot|wasm)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>

    <FilesMatch "^(index\\.html|service-worker-pwa\\.js|registerSW\\.js|manifest\\.webmanifest|build\\.json|version\\.json|branch\\.json|servers\\.json)$">
        Header set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
        Header set Pragma "no-cache"
        Header set Expires "0"
    </FilesMatch>
</IfModule>
`

/**
 * Manages the deployment of applications to various platforms (production, staging, test).
 * Handles building, zipping, copying, deploying, and Git tag management.
 *
 * @class
 */
export class Deployment {
    // Define supported platforms and products
    /**
     * Supported platforms for deployment.
     * @type {Object<string, string>}
     */
    platforms = {production: 'production', staging: 'staging', test: 'test'}

    /**
     * Supported products for deployment.
     * @type {Object<string, string>}
     */
    products = {studio: 'studio', backend: 'backend'}

    // ANSI color codes for console output formatting
    /**
     * ANSI color codes for console output formatting.
     * @type {string}
     */
    red = '\x1b[31m'
    green = '\x1b[32m'
    yellow = '\x1b[33m'
    reset = '\x1b[0m'

    /**
     * Creates a new Deployment instance and initiates the configuration process.
     *
     * @param {Object} params - Deployment parameters.
     * @param {string} params.product - The product to deploy ('studio' or 'backend').
     * @param {string} params.platform - The target platform ('production', 'staging', or 'test').
     * @param {string} params.local - The local base path for deployment files.
     */
    constructor(params) {
        this.product = params.product
        this.platform = params.platform
        this.local = params.local
        this.done = this.configure().then(() => this.launch())
    }

    /**
     * Loads deployment settings from a YAML file and initializes Git and SSH configurations.
     *
     * @returns {Promise<void>} Resolves when configuration is complete.
     * @private
     */
    configure = async () => {
        // Parse deployment configuration from YAML file
        this.configuration = parseYaml(fs.readFileSync('deployment/deploy.yml', 'utf8'))
        this.version = await this.getVersion()
        this.remoteUser = this.configuration.remote[this.platform].user
        this.remoteHost = this.configuration.remote[this.platform].host
        this.remotePath = `${this.configuration.remote[this.platform].path}/${this.platform}/${this.product}`
        this.remoteReleasePath = `${this.remotePath}/${this.configuration.remote.releases}`
        this.deploymentDir = 'deployment'

        // Set local and remote paths for the build
        this.dist = this.configuration.local.dist
        this.current = this.configuration.remote.current
        this.localDistPath = path.join(`${this.local}/${this.product}`, `./${this.dist}/${this.version}`)

        // Load environment variables for authentication
        this.password = process.env[`LGS1920_PASSWORD_${this.platform.toUpperCase()}`]
        this.github_token = process.env[`LGS1920_GITHUB_TOKEN`]
        this.github_user = process.env[`LGS1920_GITHUB_USER`]

        // Initialize Git with GitHub token authentication
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

        // Load PM2 configuration for backend deployments
        this.pm2 = this.configuration.backend[this.platform].pm2
        if (this.product === this.products.backend) {
            this.backendEnvironmentPaths = createBackendEnvironmentPaths({
                localRoot:         this.local,
                remoteBackendRoot: this.remotePath,
                environmentFile:   this.pm2.environmentFile,
            })
            if (!fs.existsSync(this.backendEnvironmentPaths.localPath)) {
                throw new Error(`Backend environment file is missing: ${this.backendEnvironmentPaths.localPath}`)
            }
            fs.accessSync(this.backendEnvironmentPaths.localPath, fs.constants.R_OK)
            const environmentStats = fs.lstatSync(this.backendEnvironmentPaths.localPath)
            if (!environmentStats.isFile()) {
                throw new Error(`Backend environment path is not a regular file: ${this.backendEnvironmentPaths.localPath}`)
            }
            if ((environmentStats.mode & 0o077) !== 0) {
                fs.chmodSync(this.backendEnvironmentPaths.localPath, 0o600)
            }
        }

        // Generate timestamp for tag naming (format: YYYYMMDDHHMMSS)
        this.date = new Date().toISOString()
            .replace(/[-:.]/g, '')
            .slice(0, 15)

        // Retrieve current Git branch
        this.branch = (await this.git.status()).current
    }

    /**
     * Retrieves the version of the product from a JSON file.
     *
     * @returns {Promise<string>} The version string for the specified product.
     * @throws {Error} If the version file is not found or invalid.
     * @private
     */
    getVersion = async () => {
        switch (this.product) {
            case 'studio': {
                return JSON.parse(fs.readFileSync('./public/version.json', 'utf8')).studio
            }
            case 'backend': {
                return JSON.parse(fs.readFileSync('./version.json', 'utf8')).backend
            }
        }
    }

    /**
     * Saves the current branch information to a JSON file.
     *
     * @returns {Promise<void>} Resolves when the branch.json file is written.
     * @private
     */
    saveBranchInfo = async () => {
        const data = {
            branch: this.branch,
        }

        // Write branch data to branch.json
        fs.writeFileSync(`${this.localDistPath}/branch.json`, JSON.stringify(data, null, 2), 'utf8')
        console.log(`    > ${this.yellow}Branch info saved to branch.json${this.reset}`)
    }

    /**
     * Creates a symbolic link on the remote server to point to the latest release.
     *
     * @param {SSH2} connection - The SSH2 connection object.
     * @returns {Promise<void>} Resolves when the symbolic link is created and the zip file is removed.
     * @throws {Error} If the link creation or zip removal fails.
     * @private
     */
    link = async (connection) => {
        return new Promise((resolve, reject) => {
            console.log('    > Creating symbolic link...')
            connection.exec(`ln -sfn ${this.remoteReleasePath}/${this.version} ${this.remotePath}/${this.current} && rm ${this.remoteReleasePath}/${this.version}.zip`, (err, stream) => {
                if (err) {
                    console.error(`${this.red}Link creation failed: ${err}${this.reset}`)
                    reject(err)
                    return
                }
                stream.on('close', () => {
                    console.log('\n---')
                    console.log(`    ${this.yellow}👍 ${this.green}Deployment completed successfully${this.reset}`)
                    console.log('---')

                    resolve()
                }).on('data', () => {
                    // Log stdout data if needed
                }).stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`)
                })
            })
        })
    }

    /**
     * Run one remote command and reject when it exits unsuccessfully.
     *
     * @param {SSH2} connection Active SSH connection.
     * @param {string} command Remote shell command.
     * @param {string} failureMessage Public-safe failure description.
     * @returns {Promise<void>} Resolves when the command succeeds.
     * @private
     */
    executeRemoteCommand = async (connection, command, failureMessage) => new Promise((resolve, reject) => {
        connection.exec(command, (err, stream) => {
            if (err) {
                reject(new Error(failureMessage, {cause: err}))
                return
            }

            let stderr = ''
            stream.on('data', () => {})
            stream.stderr.on('data', data => {
                stderr += data.toString()
            })
            stream.on('close', code => {
                if (code === 0) {
                    resolve()
                    return
                }

                reject(new Error(`${failureMessage}${stderr ? `: ${stderr.trim()}` : ''}`))
            })
        })
    })

    /**
     * Upload the local backend environment to protected shared server storage.
     *
     * The transfer uses the active SSH connection and never places the
     * environment file in the versioned release archive.
     *
     * @param {SSH2} connection Active SSH connection.
     * @returns {Promise<void>} Resolves when the environment is uploaded and protected.
     * @private
     */
    uploadBackendEnvironment = async (connection) => {
        if (this.product !== this.products.backend) {
            return
        }

        const {localPath, remotePath} = this.backendEnvironmentPaths
        const environmentContent = createBackendEnvironmentContent(fs.readFileSync(localPath, 'utf8'))
        const remoteDirectory = path.posix.dirname(remotePath)
        await this.executeRemoteCommand(
            connection,
            `install -d -m 700 ${quoteShellArgument(remoteDirectory)}`,
            'Backend environment directory preparation failed',
        )

        await new Promise((resolve, reject) => {
            connection.sftp((err, sftp) => {
                if (err) {
                    reject(new Error('Backend environment transfer initialization failed', {cause: err}))
                    return
                }

                const stream = sftp.createWriteStream(remotePath, {flags: 'w', mode: 0o600})
                stream.on('error', error => reject(new Error('Backend environment transfer failed', {cause: error})))
                stream.on('close', resolve)
                stream.end(environmentContent, 'utf8')
            })
        })

        await this.executeRemoteCommand(
            connection,
            `chmod 600 ${quoteShellArgument(remotePath)}`,
            'Backend environment permissions update failed',
        )
        console.log('    > Backend environment uploaded securely')
    }

    /**
     * Unzips the release package on the remote server after removing the destination directory if it exists.
     *
     * @param {SSH2} connection - The SSH2 connection object.
     * @returns {Promise<void>} Resolves when the unzip operation is complete.
     * @throws {Error} If the unzip operation or directory removal fails.
     * @private
     */
    unzip = async (connection) => {
        console.log(`    > Unzipping release on ${this.platform}`)
        return new Promise((resolve, reject) => {
            // Command to remove the destination directory if it exists and then unzip
            const command = `rm -rf ${this.remoteReleasePath}/${this.version} && unzip -o ${this.remoteReleasePath}/${this.version}.zip -d ${this.remoteReleasePath}/${this.version}`
            connection.exec(command, (err, stream) => {
                if (err) {
                    console.error(`${this.red}Unzip or directory removal failed: ${err}${this.reset}`)
                    reject(err)
                    return
                }
                stream.on('close', () => {
                    console.log(`    > ${this.green}Unzip completed successfully${this.reset}`)
                    resolve()
                }).on('data', () => {
                    // Log stdout data if needed
                }).stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`)
                })
            })
        })
    }

    /**
     * Performs post-deployment tasks, such as restarting the backend using PM2.
     *
     * @param {SSH2} connection - The SSH2 connection object.
     * @returns {Promise<void>} Resolves when post-deployment tasks are complete.
     * @throws {Error} If the PM2 restart fails.
     * @private
     */
    postDeployment = async (connection) => {
        console.log('\n--- Post deployment tasks')
        if (this.product !== this.products.backend) {
            return
        }
        console.log('    > Loading backend environment')
        return new Promise((resolve, reject) => {
            // Restart backend using PM2 with platform-specific command
            connection.exec(this.configuration.backend[this.platform].pm2.command, (err, stream) => {
                if (err) {
                    console.error(`${this.red}PM2 restart failed: ${err}${this.reset}`)
                    reject(err)
                    return
                }
                stream.on('close', () => {
                    console.log(`    > ${this.green}Backend restarted successfully${this.reset}`)
                    resolve()
                }).on('data', () => {
                    // Log stdout data if needed
                }).stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`)
                })
            })
        })
    }

    /**
     * Builds the application based on the product type.
     *
     * @returns {Promise<void>} Resolves when the build is complete.
     * @throws {Error} If the build process fails.
     * @private
     */
    build = async () => {
        // Remove existing version directory and create a new one
        execSync(`rm -rf ${this.localDistPath} && mkdir -p ${this.localDistPath}`)

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
                    console.error(`${this.red}Build error: ${error.message}${this.reset}`)
                    reject(`${this.red}Build error: ${error.message}${this.reset}`)
                    return
                }
                console.log(`    > ${this.green}Build completed on ${this.localDistPath}${this.reset}`)
                console.log('')
                resolve()
            })
        })
    }

    /**
     * Compresses the built application into a zip file.
     *
     * @returns {Promise<void>} Resolves when the zip operation is complete.
     * @throws {Error} If the zip operation fails.
     * @private
     */
    zip = async () => {
        console.log(`    > Zipping version`)
        try {
            await zip(this.localDistPath, `${this.localDistPath}.zip`)
            console.log(`    > ${this.green}Version zipped successfully${this.reset}`)
        }
        catch (error) {
            console.error(`${this.red}Zip failed: ${error.message}${this.reset}`)
            throw new Error(`Zip failed: ${error.message}`, {cause: error})
        }
    }

    /**
     * Copies the zipped application to the remote server using SCP.
     *
     * @returns {Promise<void>} Resolves when the file is copied.
     * @throws {Error} If the copy operation fails.
     * @private
     */
    copy = async () => {
        return new Promise((resolve, reject) => {
            const localFile = `${this.localDistPath}.zip`
            const remoteTarget = `${this.sshConfig.username}@${this.sshConfig.host}:${this.remoteReleasePath}`
            const password = this.sshConfig.password

            console.log('    > Copying file...')

            const args = [
                '-p', password,
                'scp',
                '-o', 'StrictHostKeyChecking=no',
                localFile,
                remoteTarget,
            ]

            const scp = spawn('sshpass', args)

            scp.stdout.on('data', data => process.stdout.write(data))
            scp.stderr.on('data', data => process.stderr.write(data))

            scp.on('close', code => {
                if (code === 0) {
                    console.log(`    > ${this.green}File copied successfully${this.reset}`)
                    resolve()
                }
                else {
                    console.error(`${this.red}SCP failed with code ${code}${this.reset}`)
                    reject(`Error during file copy: scp exited with code ${code}`)
                }
            })
        })
    }

    /**
     * Retrieves the specified Git remote.
     *
     * @param {string} [target='origin'] - The name of the remote to retrieve.
     * @returns {Promise<Object>} The remote object if found.
     * @throws {Error} If the remote cannot be retrieved.
     * @private
     */
    remote = async (target = 'origin') => {
        try {
            const remotes = await this.git.getRemotes(true)
            return remotes.find(remote => remote.name === target)
        }
        catch (error) {
            console.error(`${this.red}Error retrieving remotes: ${error}${this.reset}`)
            process.exit(1)
        }
    }

    /**
     * Creates a Git tag for the deployment in the format: <platform>-<version>-<branch>-<date>.
     *
     * @returns {Promise<void>} Resolves when the tag is created.
     * @private
     */
    gitTag = async () => {
        this.tagName = `${this.platform}-${this.version}-${this.branch}-${this.date}`
        const message = `Branch ${this.branch} deployed on ${this.tagName}!`
        console.log(`    > Creating Git tag: ${this.tagName}`)
        await this.git.commit(message)
        await this.git.addTag(this.tagName)
        console.log(`    > ${this.green}Git tag created successfully${this.reset}`)
    }

    /**
     * Pushes the Git tag and branch to the remote repository.
     *
     * @returns {Promise<void>} Resolves when the tag and branch are pushed.
     * @private
     */
    pushTag = async () => {
        console.log(`    > Pushing Git tag on branch ${this.branch}`)
        await this.git.push('origin', this.branch)
        await this.git.pushTags('origin')
        console.log(`    > ${this.green}Tag ${this.yellow}${this.tagName}${this.green} pushed to remote repository${this.reset}`)
    }

    /**
     * Deletes the Git tag locally and remotely.
     *
     * @returns {Promise<void>} Resolves when the tag is deleted.
     * @private
     */
    deleteTag = async () => {
        if (!this.tagName) {
            return
        }

        console.log(`    > Deleting Git tag: ${this.tagName}`)
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
     * Closes an SSH connection and forces cleanup if the remote side does not close it.
     *
     * @param {SSH2} connection - The SSH2 connection object.
     * @returns {Promise<void>} Resolves when the connection is closed or force-cleaned.
     * @private
     */
    closeConnection = async (connection) => {
        if (!connection) {
            return
        }

        await new Promise(resolve => {
            let settled = false
            const done = () => {
                if (settled) {
                    return
                }
                settled = true
                clearTimeout(timer)
                resolve()
            }
            const timer = setTimeout(() => {
                if (typeof connection.destroy === 'function') {
                    connection.destroy()
                }
                done()
            }, 1500)

            connection.once('close', done)
            connection.end()
        })
    }

    /**
     * Runs remote deployment steps inside a real promise, including SSH cleanup.
     *
     * @returns {Promise<void>} Resolves when remote deployment and connection close are complete.
     * @private
     */
    runRemoteDeployment = async () => {
        await new Promise((resolve, reject) => {
            const connection = new SSH2()
            let settled = false

            const settle = (error = null) => {
                if (settled) {
                    return
                }
                settled = true
                connection.removeAllListeners('error')
                connection.removeAllListeners('close')
                if (error) {
                    reject(error)
                    return
                }
                resolve()
            }

            const handlePrematureClose = () => {
                settle(new Error('SSH connection closed before deployment completed'))
            }

            connection.once('ready', async () => {
                connection.removeListener('close', handlePrematureClose)
                console.log(`    > ${this.green}SSH connection established${this.reset}`)
                let failure = null

                try {
                    await this.unzip(connection)
                    await this.uploadBackendEnvironment(connection)
                    console.log('    > Deploying release...')
                    await this.link(connection)
                    await this.postDeployment(connection)
                    await this.pushTag()
                    console.log('\n---')
                    console.log(`     Application ${this.yellow}${this.product} (version: ${this.version} - branch ${this.branch}) ${this.reset} deployed to ${this.platform}${this.reset}`)
                    console.log('---\n')
                }
                catch (error) {
                    failure = error
                }
                finally {
                    connection.removeAllListeners('error')
                    await this.closeConnection(connection)
                    settle(failure)
                }
            })
            connection.once('error', settle)
            connection.once('close', handlePrematureClose)
            connection.connect(this.sshConfig)
        })
    }

    /**
     * Prepares files and creates a Git tag before deployment.
     * For 'studio', updates service-worker-pwa.js and manifest.webmanifest.
     * For 'backend', copies PM2 configuration and renames files.
     *
     * @returns {Promise<void>} Resolves when pre-deployment tasks are complete.
     * @private
     */
    preDeployment = async () => {
        console.log('--- Pre-deployment tasks')
        // Create Git tag locally
        await this.gitTag()
        console.log('    > Preparing files')
        switch (this.product) {
            case 'studio': {
                const htaccessPath = path.join(this.localDistPath, '.htaccess')
                fs.writeFileSync(htaccessPath, STUDIO_HTACCESS_CONTENT, 'utf8')
                console.log(`    > ${this.yellow}Cache headers configured in .htaccess${this.reset}`)

                const serviceWorkerPath = path.join(this.localDistPath, 'service-worker-pwa.js')
                if (fs.existsSync(serviceWorkerPath)) {
                    const replaceServiceWorkerPlaceholder = (content, placeholder, value) => {
                        const encodedValue = JSON.stringify(String(value))
                        return content
                            .replace(new RegExp(`(['"])${placeholder}\\1`, 'g'), encodedValue)
                            .replace(new RegExp(placeholder, 'g'), String(value))
                    }
                    let serviceWorkerContent = fs.readFileSync(serviceWorkerPath, 'utf8')
                    serviceWorkerContent = replaceServiceWorkerPlaceholder(serviceWorkerContent, '__BUILD_TIME__', this.date)
                    serviceWorkerContent = replaceServiceWorkerPlaceholder(serviceWorkerContent, '__VERSION__', this.version)
                    serviceWorkerContent = replaceServiceWorkerPlaceholder(serviceWorkerContent, '__BRANCH__', this.branch)

                    fs.writeFileSync(serviceWorkerPath, serviceWorkerContent, 'utf8')
                    console.log(`    > Service Worker configured`)
                }

                // Update manifest.webmanifest for studio
                const manifestPath = path.join(this.localDistPath, 'manifest.webmanifest')
                if (fs.existsSync(manifestPath)) {
                    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
                    const replacement = this.platform === 'production'
                                        ? ''
                                        : this.platform.charAt(0).toUpperCase() + this.platform.slice(1)
                    manifestContent.name = STUDIO_APP_NAME.replace('Development', replacement)
                    fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2), 'utf8')
                    console.log(`    > Manifest configured for ${manifestContent.name}`)
                }
                else {
                    console.warn(`    > ${this.yellow}manifest.webmanifest not found in ${this.localDistPath}${this.reset}`)
                }

                break
            }
            case 'backend': {
                // Copy PM2 configuration and rename files for backend
                execSync(`cp -f ${this.deploymentDir}/pm2-config/${this.pm2.config} ${this.localDistPath}/ecosystem.config.js`)
                // Copy version.json and rename index.js to backend.js
                execSync(`cp -f version.json ${this.localDistPath} && mv ${this.localDistPath}/index.js ${this.localDistPath}/backend.js`)
                console.log(`    > ${this.green}Backend files prepared${this.reset}`)
            }
        }
        if (this.product === this.products.backend) {
            // Load the shared backend-only environment remotely so SMTP credentials never enter Studio releases.
            const backendRoot = path.join(this.configuration.remote[this.platform].path, this.platform, 'backend')
            const where = path.join(backendRoot, this.current)
            const environmentFile = path.join(backendRoot, this.pm2.environmentFile)
            this.configuration.backend[this.platform].pm2.command = createBackendPm2Command({
                backendPath:     where,
                environmentFile,
                pm2Bin:           this.pm2.bin,
            })
        }
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
                                                                                  site:     this.configuration.site[this.platform],
                                                                              }), 'utf8')
        console.log(`    > ${this.yellow}Server configuration saved to servers.json${this.reset}`)
        // Save build date to build.json
        fs.writeFileSync(`${this.localDistPath}/build.json`, JSON.stringify({date: Date.now()}))
        console.log(`    > ${this.yellow}Build date saved to build.json${this.reset}`)
        // Save branch information
        await this.saveBranchInfo()
        // Zip the distribution
        await this.zip()
    }

    /**
     * Initiates the deployment process: build, pre-deployment, copy, unzip, link, and post-deployment.
     * Pushes Git tag on success, deletes it on failure.
     *
     * @returns {Promise<void>} Resolves when deployment is complete.
     * @throws {Error} If any deployment step fails.
     */
    launch = async () => {
        try {
            await this.build()
            await this.preDeployment()
            console.log(`\n--- Starting deployment of ${this.yellow}${this.localDistPath}.zip${this.reset} to ${this.yellow}${this.remoteReleasePath}${this.reset}`)
            await this.copy()
            console.log('    > Connecting to SSH...')
            await this.runRemoteDeployment()
        }
        catch (error) {
            console.error(`${this.red}Error: ${error}${this.reset}`)
            await this.deleteTag()
            throw error
        }
    }
}
