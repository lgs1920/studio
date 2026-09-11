#!/usr/bin/env bun

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: free-dev-port.mjs
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-11
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 *******************************************************************************/

import {spawnSync} from 'node:child_process'
import process from 'node:process'

const MIN_PORT = 1
const MAX_PORT = 65535
const RELEASE_TIMEOUT_MS = 3000
const RELEASE_POLL_INTERVAL_MS = 100

/**
 * Parse and validate a TCP port passed on the command line.
 *
 * @param {string|number} value Port value to validate.
 * @returns {number} Valid TCP port.
 */
export const parsePort = value => {
    const port = Number(value)
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
        throw new Error(`Invalid TCP port: ${value}`)
    }

    return port
}

/**
 * Parse process identifiers returned by Unix port inspection commands.
 *
 * @param {string} output Command output containing process identifiers.
 * @param {number} port Inspected port, excluded from fallback command output.
 * @returns {number[]} Unique process identifiers.
 */
export const parseUnixProcessIds = (output, port) => [...new Set(
    output
        .match(/\b\d+\b/gu)
        ?.map(Number)
        .filter(processId => processId > 1 && processId !== port)
        ?? [],
)]

/**
 * Parse process identifiers from Windows netstat output.
 *
 * @param {string} output Netstat output.
 * @param {number} port Inspected port.
 * @returns {number[]} Unique listening process identifiers.
 */
export const parseWindowsProcessIds = (output, port) => [...new Set(
    [...output.matchAll(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/gimu)]
        .filter(match => Number(match[1]) === port)
        .map(match => Number(match[2]))
        .filter(processId => processId > 1),
)]

/**
 * Run a port inspection command without invoking a shell.
 *
 * @param {string} command Executable name.
 * @param {string[]} argumentsList Executable arguments.
 * @returns {{available: boolean, output: string}} Command result.
 */
const inspectWith = (command, argumentsList) => {
    const result = spawnSync(command, argumentsList, {encoding: 'utf8'})
    if (result.error?.code === 'ENOENT') {
        return {available: false, output: ''}
    }
    if (result.error) {
        throw result.error
    }

    return {available: true, output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`}
}

/**
 * Find processes currently listening on a TCP port.
 *
 * @param {number} port TCP port to inspect.
 * @returns {number[]} Listening process identifiers.
 */
export const getListeningProcessIds = port => {
    const validatedPort = parsePort(port)

    if (process.platform === 'win32') {
        const result = inspectWith('netstat', ['-ano', '-p', 'TCP'])
        if (!result.available) {
            throw new Error('Unable to inspect TCP ports: netstat is unavailable')
        }

        return parseWindowsProcessIds(result.output, validatedPort)
    }

    const lsofResult = inspectWith('lsof', ['-nP', '-t', `-iTCP:${validatedPort}`, '-sTCP:LISTEN'])
    if (lsofResult.available) {
        return parseUnixProcessIds(lsofResult.output, validatedPort)
    }

    const fuserResult = inspectWith('fuser', ['-n', 'tcp', String(validatedPort)])
    if (fuserResult.available) {
        return parseUnixProcessIds(fuserResult.output, validatedPort)
    }

    throw new Error('Unable to inspect TCP ports: lsof and fuser are unavailable')
}

/**
 * Stop one process while tolerating a process that has already exited.
 *
 * @param {number} processId Process identifier to stop.
 * @param {'SIGTERM'|'SIGKILL'} signal Signal to send.
 * @returns {void}
 */
const stopProcess = (processId, signal) => {
    if (processId === process.pid) {
        return
    }

    try {
        process.kill(processId, signal)
    }
    catch (error) {
        if (error?.code !== 'ESRCH') {
            throw error
        }
    }
}

/**
 * Wait until a TCP port has no listening process.
 *
 * @param {number} port TCP port to monitor.
 * @param {number} timeoutMs Maximum wait time.
 * @returns {Promise<number[]>} Remaining listening process identifiers.
 */
const waitForRelease = async (port, timeoutMs) => {
    const deadline = Date.now() + timeoutMs
    let processIds = getListeningProcessIds(port)

    while (processIds.length > 0 && Date.now() < deadline) {
        await Bun.sleep(RELEASE_POLL_INTERVAL_MS)
        processIds = getListeningProcessIds(port)
    }

    return processIds
}

/**
 * Release a development TCP port before starting a local server.
 *
 * @param {number} port TCP port to release.
 * @returns {Promise<number[]>} Process identifiers stopped by the command.
 */
export const freeDevPort = async port => {
    const validatedPort = parsePort(port)
    const processIds = getListeningProcessIds(validatedPort).filter(processId => processId !== process.pid)
    if (processIds.length === 0) {
        return []
    }

    console.log(`[dev] Stopping processes listening on port ${validatedPort}: ${processIds.join(', ')}`)
    processIds.forEach(processId => stopProcess(processId, 'SIGTERM'))

    let remainingProcessIds = await waitForRelease(validatedPort, RELEASE_TIMEOUT_MS)
    if (remainingProcessIds.length > 0) {
        console.log(`[dev] Forcing processes still listening on port ${validatedPort}: ${remainingProcessIds.join(', ')}`)
        remainingProcessIds.forEach(processId => stopProcess(processId, 'SIGKILL'))
        remainingProcessIds = await waitForRelease(validatedPort, RELEASE_TIMEOUT_MS)
    }

    if (remainingProcessIds.length > 0) {
        throw new Error(`Unable to free TCP port ${validatedPort}: ${remainingProcessIds.join(', ')}`)
    }

    return processIds
}

/**
 * Run the development-port cleanup command.
 *
 * @param {string[]} argumentsList Command-line arguments.
 * @returns {Promise<void>}
 */
export const main = async argumentsList => {
    if (argumentsList.length !== 1) {
        throw new Error('Usage: bun scripts/free-dev-port.mjs <port>')
    }

    await freeDevPort(parsePort(argumentsList[0]))
}

if (import.meta.main) {
    main(process.argv.slice(2)).catch(error => {
        console.error(`[dev] ${error.message}`)
        process.exitCode = 1
    })
}
