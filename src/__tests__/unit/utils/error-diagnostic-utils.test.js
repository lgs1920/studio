import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectErrorDiagnostic, formatErrorDiagnostic, UNKNOWN_DIAGNOSTIC_VALUE } from '@Utils/ErrorDiagnosticUtils'

describe('ErrorDiagnosticUtils', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('collects complete environment, file, read, and error information', () => {
        vi.stubGlobal('navigator', {userAgent: 'Android Chrome'})
        const error = new Error('The file is unavailable')
        error.name = 'NotFoundError'
        error.code = 8
        error.readAttempts = [
            {strategy: 'file.text'},
            {strategy: 'FileReader.readAsText'},
        ]

        const diagnostic = collectErrorDiagnostic({
            context: {
                build:    {date: '2026-08-17T13:12:30Z'},
                platform: 'staging',
                versions: {studio: '1.0.0'},
            },
            error,
            file: {
                lastModified: Date.parse('2026-08-15T19:41:51Z'),
                name:         'race.gpx',
                size:         35645,
                type:         'application/gpx+xml',
            },
            suggestedFix: 'Copy the file to the device Downloads folder.',
        })

        expect(diagnostic).toMatchObject({
            browser:      'Android Chrome',
            errorCode:    '8',
            errorName:    'NotFoundError',
            fileName:     'race.gpx',
            fileSize:     '35645 bytes',
            fileType:     'application/gpx+xml',
            platform:     'staging',
            readStrategy: 'file.text, FileReader.readAsText',
            suggestedFix: 'Copy the file to the device Downloads folder.',
            version:      '1.0.0',
        })
        expect(formatErrorDiagnostic(diagnostic)).toContain('Original error:\nThe file is unavailable')
    })

    it('marks unavailable values without preventing report generation', () => {
        vi.stubGlobal('navigator', undefined)
        const diagnostic = collectErrorDiagnostic({error: new Error('Import failed')})

        expect(diagnostic.fileName).toBe(UNKNOWN_DIAGNOSTIC_VALUE)
        expect(diagnostic.fileSize).toBe(UNKNOWN_DIAGNOSTIC_VALUE)
        expect(diagnostic.readStrategy).toBe(UNKNOWN_DIAGNOSTIC_VALUE)
        expect(formatErrorDiagnostic(diagnostic)).toContain(`Suggested fix: ${UNKNOWN_DIAGNOSTIC_VALUE}`)
    })
})
