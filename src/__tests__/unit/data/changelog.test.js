/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: changelog.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it }                                                  from 'vitest'
import { changelogFileName, changelogVersionFromFile, normalizeChangelogFile } from '../../../core/ui/ChangelogManager'

describe('Changelog version parsing', () => {
    it('keeps prerelease suffixes from changelog filenames', () => {
        expect(changelogVersionFromFile('20260430-1.0.0-beta.1.md')).toBe('1.0.0-beta.1')
        expect(changelogVersionFromFile('20260430-1.0.0-alpha.4.md')).toBe('1.0.0-alpha.4')
        expect(changelogVersionFromFile('20260430-1.0.0-RC12.md')).toBe('1.0.0-RC12')
    })

    it('keeps standard versions from changelog filenames', () => {
        expect(changelogVersionFromFile('20250302-0.10.0.md')).toBe('0.10.0')
        expect(changelogVersionFromFile('/assets/changelog/20240617-0.1.md')).toBe('0.1')
        expect(changelogVersionFromFile({name: '20260430-1.0.0-beta.1.md'})).toBe('1.0.0-beta.1')
    })

    it('returns null for invalid changelog filenames', () => {
        expect(changelogVersionFromFile('not-a-changelog.md')).toBeNull()
        expect(changelogVersionFromFile(null)).toBeNull()
    })
})

describe('Changelog file normalization', () => {
    it('keeps a stable file key when the API returns name or path', () => {
        expect(changelogFileName({name: '20260430-1.0.0-beta.1.md'})).toBe('20260430-1.0.0-beta.1.md')
        expect(changelogFileName({path: '/assets/changelog/20250302-0.10.0.md'})).toBe('20250302-0.10.0.md')
    })

    it('normalizes changelog entries before paging', () => {
        expect(normalizeChangelogFile({
            name: '20260430-1.0.0-beta.1.md',
            time: 1777500000000,
        })).toEqual({
            file:    '20260430-1.0.0-beta.1.md',
            name:    '20260430-1.0.0-beta.1.md',
            time:    1777500000000,
            version: '1.0.0-beta.1',
        })
    })
})
