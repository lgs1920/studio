/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: update-file-headers.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-31
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {buildHeader, parseArguments, processFiles, updateHeader} from '../../../../scripts/update-file-headers.mjs'

describe('update-file-headers', () => {
    it('builds the shared WebStorm header with the Git-derived dates', () => {
        const header = buildHeader('src/core/Example.js', '2026-08-01', '2026-08-31')

        expect(header.startsWith('/*******************************************************************************')).toBe(true)
        expect(header).toContain('File: Example.js')
        expect(header).toContain('email: studio@lgs1920.fr')
        expect(header).toContain('Created on: 2026-08-01')
        expect(header).toContain('Last modified: 2026-08-31')
    })

    it('preserves the Vitest environment directive before the header', () => {
        const content = '// @vitest-environment jsdom\n\nimport {describe} from \'vitest\'\n'
        const updated = updateHeader(content, 'src/example.test.js', '2026-08-01', '2026-08-31')

        expect(updated.startsWith('// @vitest-environment jsdom\n')).toBe(true)
        expect(updated.indexOf('This file is part of the LGS1920/studio project.')).toBeGreaterThan(0)
        expect(updated).toContain("import {describe} from 'vitest'")
    })

    it('replaces an existing project header instead of duplicating it', () => {
        const content = `${buildHeader('src/Old.js', '2026-01-01', '2026-01-02')}\n\nexport const value = 1\n`
        const updated = updateHeader(content, 'src/New.js', '2026-02-01', '2026-02-02')

        expect(updated.match(/This file is part of the LGS1920\/studio project\./g)).toHaveLength(1)
        expect(updated).toContain('File: New.js')
        expect(updated).toContain('export const value = 1')
    })

    it('parses staged update options', () => {
        expect(parseArguments(['--staged', '--stage'])).toEqual({
            checkOnly: false,
            filePaths: [],
            stageChanges: true,
        })
    })

    it('processes every file after a check failure', () => {
        const processedFiles = []
        const success = processFiles(['first.js', 'second.js'], filePath => {
            processedFiles.push(filePath)
            return filePath !== 'first.js'
        })

        expect(processedFiles).toEqual(['first.js', 'second.js'])
        expect(success).toBe(false)
    })
})
