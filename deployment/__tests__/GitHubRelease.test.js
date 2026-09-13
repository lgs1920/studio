/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GitHubRelease.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-13
 * Last modified: 2026-09-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, test, vi} from 'vitest'
import {buildGitHubReleaseArguments, createGitHubRelease} from '../GitHubRelease.js'

describe('GitHub release arguments', () => {
    test('creates a draft release by default', () => {
        expect(buildGitHubReleaseArguments({
            tag:    'v1.0.0',
            target: 'commit-sha',
            title:  'LGS1920 studio v1.0.0',
        })).toEqual([
            'release',
            'create',
            'v1.0.0',
            '--target',
            'commit-sha',
            '--title',
            'LGS1920 studio v1.0.0',
            '--generate-notes',
            '--draft',
        ])
    })

    test('publishes when auto mode is enabled', () => {
        expect(buildGitHubReleaseArguments({
            tag:    'v1.0.0',
            target: 'commit-sha',
            title:  'LGS1920 studio v1.0.0',
            auto:   true,
        })).not.toContain('--draft')
    })
})

describe('GitHub release creation', () => {
    test('returns the URL printed by the GitHub CLI', () => {
        const runCommand = vi.fn()
            .mockReturnValueOnce('')
            .mockReturnValueOnce('https://github.com/lgs1920/studio/releases/tag/v1.0.0\n')

        const result = createGitHubRelease({
            product:    'studio',
            root:       process.cwd(),
            target:     'commit-sha',
            runCommand,
        })

        expect(result).toEqual({
            tag:   'v1.0.0',
            url:   'https://github.com/lgs1920/studio/releases/tag/v1.0.0',
            draft: true,
        })
        expect(runCommand).toHaveBeenLastCalledWith(
            'gh',
            expect.arrayContaining(['v1.0.0', '--draft']),
            expect.objectContaining({cwd: process.cwd()}),
        )
    })
})
