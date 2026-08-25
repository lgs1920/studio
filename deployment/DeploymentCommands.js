import path from 'node:path'
import {randomBytes} from 'node:crypto'

const CONTACT_CSRF_SECRET_NAME = 'LGS1920_CONTACT_CSRF_SECRET'
const DEFAULT_BUN_BIN = '/home/.bun/bin/bun'
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const SAFE_UNQUOTED_ENV_VALUE_PATTERN = /^[A-Za-z0-9_./:@%+,\-]*$/
const SINGLE_QUOTED_ENV_VALUE_PATTERN = /^'(?:[^']*)'$/
const DOUBLE_QUOTED_ENV_VALUE_PATTERN = /^"(?:[^"\\]|\\.)*"$/

/**
 * Generate a cryptographically secure contact CSRF secret.
 *
 * @returns {string} A 256-bit hexadecimal secret.
 */
export const generateContactCsrfSecret = () => randomBytes(32).toString('hex')

/**
 * Validate environment content before it is transferred and sourced by POSIX shell.
 *
 * @param {string} content Backend environment file content.
 * @returns {void}
 * @throws {TypeError} If a line is not a safe environment assignment.
 */
export const validateBackendEnvironmentContent = (content) => {
    if (typeof content !== 'string') {
        throw new TypeError('Backend environment content is invalid')
    }

    content.split(/\r?\n/).forEach((line, index) => {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            return
        }

        const assignment = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
        if (!assignment || !ENV_NAME_PATTERN.test(assignment[1])) {
            throw new TypeError(`Backend environment line ${index + 1} is not a valid assignment or comment`)
        }

        const value = assignment[2]
        const isSafeValue = !value
            || SAFE_UNQUOTED_ENV_VALUE_PATTERN.test(value)
            || SINGLE_QUOTED_ENV_VALUE_PATTERN.test(value)
            || DOUBLE_QUOTED_ENV_VALUE_PATTERN.test(value)

        if (!isSafeValue) {
            throw new TypeError(`Backend environment line ${index + 1} for ${assignment[1]} must quote shell characters`)
        }
    })
}

/**
 * Set the contact CSRF secret in backend environment content.
 *
 * @param {string} content Backend environment file content.
 * @param {string} [secret=generateContactCsrfSecret()] Contact CSRF secret.
 * @returns {string} Environment content with the rotated secret.
 * @throws {TypeError} If the environment content or secret is invalid.
 */
export const createBackendEnvironmentContent = (content, secret = generateContactCsrfSecret()) => {
    if (typeof content !== 'string' || typeof secret !== 'string' || !secret) {
        throw new TypeError('Backend environment content or CSRF secret is invalid')
    }

    validateBackendEnvironmentContent(content)

    const secretLine = `${CONTACT_CSRF_SECRET_NAME}=${secret}`
    const secretPattern = new RegExp(`^(?:export\\s+)?${CONTACT_CSRF_SECRET_NAME}=.*$`, 'gm')
    const contentWithSecret = secretPattern.test(content)
        ? content.replace(secretPattern, secretLine)
        : `${content}${content && !content.endsWith('\n') ? '\n' : ''}${secretLine}\n`

    return contentWithSecret
}

/**
 * Quote one value for use as a POSIX shell argument.
 *
 * @param {*} value Value to quote.
 * @returns {string} Safely quoted shell argument.
 */
export const quoteShellArgument = (value) => `'${String(value).replaceAll("'", "'\\''")}'`

/**
 * Build the remote PM2 command used to start the backend with its environment.
 *
 * @param {object} options Command options.
 * @param {string} options.backendPath Active backend release path.
 * @param {string} options.environmentFile Backend-only environment file path.
 * @param {string} options.pm2Bin Absolute PM2 executable path.
 * @param {string} options.bunBin Absolute Bun executable path.
 * @param {string} options.pm2App PM2 backend application name.
 * @param {string} options.platform Backend deployment platform.
 * @param {number} options.backendPort Backend listening port.
 * @returns {string} Remote shell command.
 * @throws {TypeError} If a required command option is missing.
 */
export const createBackendPm2Command = ({
    backendPath,
    environmentFile,
    pm2Bin,
    bunBin = DEFAULT_BUN_BIN,
    pm2App,
    platform,
    backendPort,
} = {}) => {
    if (!backendPath || !environmentFile || !pm2Bin || !pm2App || !platform || !backendPort) {
        throw new TypeError('Backend PM2 command options are incomplete')
    }

    const ecosystemFile = `${backendPath}/ecosystem.config.js`
    const backendRoot = path.posix.dirname(backendPath)
    const sharedDirectory = path.posix.join(backendRoot, 'shared')
    const sharedLogDirectory = path.posix.join(sharedDirectory, 'logs')
    const startupScript = path.posix.join(backendPath, 'backend-startup.js')
    const watchdogScript = path.posix.join(backendPath, 'backend-watchdog.js')
    const statePath = path.posix.join(sharedDirectory, 'backend-watchdog-state.json')
    const watchdogLogPath = path.posix.join(sharedLogDirectory, 'watchdog.log')
    const startupLogPath = path.posix.join(sharedLogDirectory, 'startup.log')
    const temporaryCrontabPath = path.posix.join(sharedDirectory, '.backend-watchdog-crontab')
    const quotedBackendPath = quoteShellArgument(backendPath)
    const quotedEnvironmentFile = quoteShellArgument(environmentFile)
    const quotedEcosystemFile = quoteShellArgument(ecosystemFile)
    const quotedSharedLogDirectory = quoteShellArgument(sharedLogDirectory)
    const quotedPm2Bin = quoteShellArgument(pm2Bin)
    const quotedLogrotateModule = quoteShellArgument('pm2-logrotate')
    const quotedBunBin = quoteShellArgument(bunBin)
    const quotedPm2App = quoteShellArgument(pm2App)
    const quotedPlatform = quoteShellArgument(platform)
    const quotedWatchdogUrl = quoteShellArgument(`http://127.0.0.1:${backendPort}/ping`)
    const quotedStartupScript = quoteShellArgument(startupScript)
    const quotedWatchdogScript = quoteShellArgument(watchdogScript)
    const quotedStatePath = quoteShellArgument(statePath)
    const quotedWatchdogLogPath = quoteShellArgument(watchdogLogPath)
    const quotedStartupLogPath = quoteShellArgument(startupLogPath)
    const quotedTemporaryCrontabPath = quoteShellArgument(temporaryCrontabPath)
    const watchdogCronBegin = `# BEGIN LGS1920 BACKEND WATCHDOG ${platform}`
    const watchdogCronEnd = `# END LGS1920 BACKEND WATCHDOG ${platform}`
    const quotedCronLines = [
        watchdogCronBegin,
        `*/5 * * * * ${quotedBunBin} ${quotedWatchdogScript} --platform ${quotedPlatform} --url ${quotedWatchdogUrl} --pm2-bin ${quotedPm2Bin} --pm2-app ${quotedPm2App} --environment-file ${quotedEnvironmentFile} --state-path ${quotedStatePath} >> ${quotedWatchdogLogPath} 2>&1`,
        `@reboot sleep 30 && ${quotedBunBin} ${quotedStartupScript} --backend-path ${quotedBackendPath} --environment-file ${quotedEnvironmentFile} --pm2-bin ${quotedPm2Bin} >> ${quotedStartupLogPath} 2>&1`,
        watchdogCronEnd,
    ].map(quoteShellArgument).join(' ')

    return [
        `cd ${quotedBackendPath}`,
        `install -d -m 750 ${quotedSharedLogDirectory}`,
        `test -r ${quotedEnvironmentFile}`,
        'set -a',
        `. ${quotedEnvironmentFile}`,
        'set +a',
        `if ! ${quotedPm2Bin} describe ${quotedLogrotateModule} >/dev/null 2>&1; then ${quotedPm2Bin} install ${quotedLogrotateModule}; fi`,
        `${quotedPm2Bin} set pm2-logrotate:max_size 10M`,
        `${quotedPm2Bin} set pm2-logrotate:retain 14`,
        `${quotedPm2Bin} set pm2-logrotate:compress true`,
        `${quotedPm2Bin} set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss`,
        `${quotedPm2Bin} startOrRestart ${quotedEcosystemFile} --cwd ${quotedBackendPath} --update-env`,
        `if crontab -l 2>/dev/null > ${quotedTemporaryCrontabPath}; then :; else : > ${quotedTemporaryCrontabPath}; fi`,
        `sed -i '/^${watchdogCronBegin}$/,/^${watchdogCronEnd}$/d' ${quotedTemporaryCrontabPath}`,
        `printf '%s\\n' ${quotedCronLines} >> ${quotedTemporaryCrontabPath}`,
        `crontab ${quotedTemporaryCrontabPath}`,
        `rm -f ${quotedTemporaryCrontabPath}`,
        `${quotedPm2Bin} save`,
    ].join(' && ')
}

/**
 * Resolve the local source and remote destination for the backend environment.
 *
 * @param {object} options Environment path options.
 * @param {string} options.localRoot Local LGS1920 workspace root.
 * @param {string} options.remoteBackendRoot Remote platform backend root.
 * @param {string} options.environmentFile Relative backend environment path.
 * @returns {{localPath: string, remotePath: string}} Environment transfer paths.
 * @throws {TypeError} If a required path option is missing.
 */
export const createBackendEnvironmentPaths = ({localRoot, remoteBackendRoot, environmentFile} = {}) => {
    if (!localRoot || !remoteBackendRoot || !environmentFile) {
        throw new TypeError('Backend environment path options are incomplete')
    }

    return {
        localPath:  path.join(localRoot, 'backend', '.env'),
        remotePath: path.posix.join(remoteBackendRoot, environmentFile),
    }
}

/**
 * Resolve the persistent launch-registration file for a deployed backend.
 *
 * @param {object} options Registration storage path options.
 * @param {string} options.remoteBackendRoot Remote backend root directory.
 * @param {string} [options.registrationFile='shared/launch-registrations.json'] Relative or absolute registration file path.
 * @returns {string} Absolute registration file path on the remote server.
 * @throws {TypeError} If a required path option is missing.
 */
export const resolveBackendRegistrationFile = ({
    remoteBackendRoot,
    registrationFile = 'shared/launch-registrations.json',
} = {}) => {
    if (!remoteBackendRoot || !registrationFile) {
        throw new TypeError('Backend registration storage options are incomplete')
    }

    return path.isAbsolute(registrationFile)
        ? path.normalize(registrationFile)
        : path.posix.join(remoteBackendRoot, registrationFile)
}
