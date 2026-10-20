/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: browser.mjs
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-20
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {spawnSync} from 'node:child_process'
import {accessSync, constants, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync} from 'node:fs'
import {homedir, tmpdir, userInfo} from 'node:os'
import {join} from 'node:path'

const PROFILE = join(homedir(), '.cache/chrome-devtools-mcp-cli/chrome-profile')
const LOG_DIRECTORY = join(homedir(), '.cache/chrome-devtools-mcp-cli')
const CHROME_ARGUMENTS = [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader-webgl',
    '--enable-unsafe-swiftshader',
]

/** Return a CLI environment with an accessible daemon runtime and, for headless launches, no desktop dependencies. */
const browserEnvironment = (headlessLaunch = false) => {
    const environment = {...process.env}
    if (environment.XDG_RUNTIME_DIR) {
        try {
            const directory = statSync(environment.XDG_RUNTIME_DIR)
            if (!directory.isDirectory() || directory.uid !== userInfo().uid) {
                throw new Error('The runtime directory does not belong to the current user')
            }
            accessSync(environment.XDG_RUNTIME_DIR, constants.R_OK | constants.W_OK | constants.X_OK)
        }
        catch {
            delete environment.XDG_RUNTIME_DIR
        }
    }
    if (headlessLaunch) {
        delete environment.DISPLAY
        delete environment.WAYLAND_DISPLAY
        delete environment.DBUS_SESSION_BUS_ADDRESS
    }
    return environment
}

/** Run the installed CLI without a shell, bounding failures so a blocked GPU cannot stall the workflow indefinitely. */
const runChrome = (argumentsList, {headlessLaunch = false, timeout = 25000} = {}) => {
    const result = spawnSync('chrome-devtools', argumentsList, {
        encoding: 'utf8',
        env: browserEnvironment(headlessLaunch),
        maxBuffer: 8 * 1024 * 1024,
        timeout,
    })
    if (result.error || result.status !== 0) {
        throw new Error(`chrome-devtools ${argumentsList[0]} failed: ${result.error?.message
            ?? (result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`)}`)
    }
    return result.stdout.trim()
}

/** Read structured CLI output while tolerating a separate version notice printed before the JSON line. */
const parseCliJson = output => {
    const jsonLine = output.split('\n').reverse().find(line => line.startsWith('{') || line.startsWith('['))
    if (!jsonLine) {
        throw new Error(`The CLI did not return structured output: ${output}`)
    }
    return JSON.parse(jsonLine)
}

/** Inspect the daemon without implicitly launching a browser with default graphics settings. */
const daemonStatus = () => {
    const output = runChrome(['status'])
    return {
        running: output.includes('daemon is running.'),
        argumentsList: JSON.parse(output.match(/^args=(.+)$/m)?.[1] ?? '[]'),
    }
}

/** Extract an explicitly configured persistent profile without substituting a new profile for existing application data. */
const daemonProfile = status => status.argumentsList.find(argument => argument.startsWith('--user-data-dir='))
    ?.slice('--user-data-dir='.length)

/** Start an owned headless test session with the verified local software renderer and a persistent profile. */
const startBrowser = profile => {
    mkdirSync(LOG_DIRECTORY, {recursive: true})
    runChrome([
        'start',
        '--executablePath', '/opt/google/chrome/chrome',
        '--userDataDir', profile,
        '--headless',
        '--logFile', join(LOG_DIRECTORY, 'webgl-browser.log'),
        ...CHROME_ARGUMENTS.map(argument => `--chromeArg=${argument}`),
    ], {headlessLaunch: true})
}

/** Verify WebGL 2 rendering inside the actual browser, accepting software rendering but rejecting missing or lost contexts. */
const probeWebgl = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('webgl2', {failIfMajorPerformanceCaveat: false})
    if (!context) {
        return {ok: false, reason: 'A WebGL 2 context could not be created'}
    }
    try {
        context.clearColor(0.25, 0.5, 0.75, 1)
        context.clear(context.COLOR_BUFFER_BIT)
        const pixels = new Uint8Array(4)
        context.readPixels(0, 0, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixels)
        const expected = [64, 128, 191, 255]
        const debug = context.getExtension('WEBGL_debug_renderer_info')
        return {
            ok: !context.isContextLost() && context.getError() === context.NO_ERROR
                && expected.every((value, index) => Math.abs(pixels[index] - value) <= 1),
            pixels: Array.from(pixels),
            version: context.getParameter(context.VERSION),
            renderer: context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER),
        }
    }
    finally {
        context.getExtension('WEBGL_lose_context')?.loseContext()
    }
}

/** Probe a temporary background page without navigating application tabs or retaining a GPU context. */
const verifyBrowser = () => {
    const previous = parseCliJson(runChrome(['list_pages', '--output-format=json'])).pages
    if (!Array.isArray(previous)) {
        throw new Error('The installed CLI did not return a page list')
    }
    const directory = mkdtempSync(join(tmpdir(), 'lgs1920-webgl-'))
    let probePage
    try {
        const created = parseCliJson(runChrome(['new_page', 'about:blank', '--background', 'true', '--output-format=json']))
        probePage = created.pages?.find(page => !previous.some(existing => existing.id === page.id))
        if (!Number.isInteger(probePage?.id)) {
            throw new Error('The temporary WebGL probe page could not be identified')
        }
        const resultPath = join(directory, 'probe.json')
        // A real output file also detects upstream tool errors that unexpectedly exit with status zero.
        runChrome([
            'evaluate_script', probeWebgl.toString(), '--pageId', String(probePage.id),
            '--waitForStableDom', 'false', '--filePath', resultPath,
        ])
        const result = JSON.parse(readFileSync(resultPath, 'utf8'))
        if (result?.ok !== true) {
            throw new Error(`WebGL 2 rendering failed: ${JSON.stringify(result)}`)
        }
        return result
    }
    finally {
        rmSync(directory, {recursive: true, force: true})
        if (probePage) {
            try {
                runChrome(['close_page', String(probePage.id)], {timeout: 5000})
                const selected = previous.find(page => page.selected)
                if (selected) {
                    runChrome(['select_page', String(selected.id), '--bringToFront', 'false'], {timeout: 5000})
                }
            }
            catch (error) {
                console.error(`Probe cleanup failed: ${error.message}. Repair the owned test session before continuing.`)
            }
        }
    }
}

/** Prepare a new browser or verify the existing one, restarting an identifiable local profile only on explicit repair. */
const ensureBrowser = (repair = false) => {
    const status = daemonStatus()
    const existingProfile = daemonProfile(status)
    if (repair && status.running) {
        const attached = status.argumentsList.some(argument => /^--(?:browser-url|ws-endpoint|auto-connect)(?:=|$)/.test(argument))
        if (attached || !existingProfile) {
            throw new Error('Repair requires an owned local daemon with an explicit persistent profile. Preserve the attached or isolated browser.')
        }
    }
    const started = repair || !status.running
    if (started) {
        startBrowser(existingProfile ?? PROFILE)
    }
    const webgl = verifyBrowser()
    console.log(JSON.stringify({ok: true, started, profile: existingProfile ?? (started ? PROFILE : null), webgl}, null, 2))
}

/** Route browser commands through the same runtime environment and prevent unconfigured implicit browser startup. */
const main = () => {
    const [command = 'ensure', ...argumentsList] = process.argv.slice(2)
    if (command === 'ensure' || command === 'repair') {
        ensureBrowser(command === 'repair')
        return
    }
    if (command === 'start') {
        throw new Error('Use ensure or repair so WebGL launch settings cannot be omitted')
    }
    const inspection = ['status', 'stop', '--help', '--version'].includes(command) || argumentsList.includes('--help')
    if (!inspection && !daemonStatus().running) {
        ensureBrowser()
    }
    console.log(runChrome([command, ...argumentsList]))
}

try {
    main()
}
catch (error) {
    console.error(error.message)
    console.error('Browser validation has not passed. Read the browser-webgl skill before repairing or retrying.')
    process.exitCode = 1
}
