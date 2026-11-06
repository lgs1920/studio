/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: browser-cli.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-06
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {spawnSync} from 'node:child_process'
import {chmodSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'

const wrapper = resolve('skills/lgs-1920-studio-browser-webgl/scripts/browser.mjs')
let directory

/** Run the public wrapper in an isolated environment without starting a real browser. */
const runWrapper = (executable = '', argumentsList = ['--version']) => spawnSync(process.execPath, [wrapper, ...argumentsList], {
    encoding: 'utf8',
    env: {...process.env, PATH: directory, LGS1920_CHROME_DEVTOOLS_CLI: executable},
    timeout: 10000,
})

/** Create a native executable fixture that preserves argument boundaries in its output. */
const createCli = (name = 'custom cli') => {
    const path = join(directory, name)
    writeFileSync(path, '#!/bin/sh\nprintf "<%s>\\n" "$@"\n')
    chmodSync(path, 0o700)
    return path
}

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'lgs1920-cli-test-'))
})

afterEach(() => {
    rmSync(directory, {recursive: true, force: true})
})

describe('browser wrapper CLI configuration', () => {
    test('reports a missing PATH command as a tooling failure with setup instructions', () => {
        const result = runWrapper('', ['ensure'])
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('ENOENT')
        expect(result.stderr).toContain('LGS1920_CHROME_DEVTOOLS_CLI')
        expect(result.stderr).toContain('tooling failure, not a WebGL rendering failure')
    })

    test('uses an explicit path with spaces and preserves literal arguments', () => {
        const result = runWrapper(createCli(), ['evaluate_script', '$(literal)', '--help'])
        expect(result.status, JSON.stringify(result)).toBe(0)
        expect(result.stdout).toBe('<evaluate_script>\n<$(literal)>\n<--help>\n')
    })

    test('keeps the PATH fallback when no override is configured', () => {
        createCli('chrome-devtools')
        const result = runWrapper()
        expect(result.status).toBe(0)
        expect(result.stdout).toBe('<--version>\n')
    })

    test('does not silently replace an invalid explicit path with the PATH command', () => {
        createCli('chrome-devtools')
        const result = runWrapper(join(directory, 'missing'))
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('ENOENT')
    })

    test('explains executable permission failures', () => {
        const path = createCli()
        chmodSync(path, 0o600)
        const result = runWrapper(path)
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('EACCES')
    })

    test.skipIf(process.platform !== 'linux')('rejects the Windows IDE launcher before executing it', () => {
        const result = runWrapper('C:\\Program Files\\WebStorm\\chrome-devtools.cmd')
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('requires a Linux CLI')
    })
})
