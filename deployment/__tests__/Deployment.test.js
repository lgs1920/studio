/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Deployment.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-27
 * Last modified: 2026-09-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, test, vi} from 'vitest'
import {
    createDeploymentIdentifier,
    deleteGitTag,
    normalizeReleaseVersion,
    pushBranchWithRetry,
} from '../Deployment.js'

describe('CI deployment metadata', () => {
    test('normalizes stable and pre-release tags', () => {
        expect(normalizeReleaseVersion('v1.0.0-beta.4')).toBe('1.0.0-beta.4')
        expect(normalizeReleaseVersion('1.1.0')).toBe('1.1.0')
    })

    test('rejects release values that could escape a remote path', () => {
        expect(() => normalizeReleaseVersion('v1.0.0/../../current')).toThrow('Invalid release version')
    })

    test('adds the immutable source suffix only for CI identifiers', () => {
        const options = {
            branch:    'release/v1.0.0-beta.4',
            date:      '20260913103000',
            platform:  'production',
            sourceRef: '0123456789abcdef',
            version:   '1.0.0-beta.4',
        }

        expect(createDeploymentIdentifier({...options, ci: true}))
            .toBe('production-1.0.0-beta.4-release/v1.0.0-beta.4-20260913103000-0123456789ab')
        expect(createDeploymentIdentifier(options))
            .toBe('production-1.0.0-beta.4-release/v1.0.0-beta.4-20260913103000')
    })
})

describe('deployment Git synchronization', () => {
    test('synchronizes a fast-forward remote commit before retrying the branch push', async () => {
        const git = {
            push: vi.fn()
                .mockRejectedValueOnce(new Error('! [rejected] (fetch first)'))
                .mockResolvedValueOnce({pushed: true}),
            pull: vi.fn().mockResolvedValue({summary: 'fast-forward'}),
        }

        await expect(pushBranchWithRetry({git, branch: '1.0.0'})).resolves.toEqual({pushed: true})

        expect(git.pull).toHaveBeenCalledWith('origin', '1.0.0', ['--ff-only'])
        expect(git.push).toHaveBeenCalledTimes(2)
        expect(git.push).toHaveBeenNthCalledWith(2, 'origin', '1.0.0')
    })

    test('does not retry a push failure unrelated to remote branch advancement', async () => {
        const git = {
            push: vi.fn().mockRejectedValue(new Error('Permission denied')),
            pull: vi.fn(),
        }

        await expect(pushBranchWithRetry({git, branch: '1.0.0'})).rejects.toThrow('Permission denied')

        expect(git.pull).not.toHaveBeenCalled()
        expect(git.push).toHaveBeenCalledTimes(1)
    })
})

describe('deployment Git tag cleanup', () => {
    test('deletes the local tag with simple-git and then deletes the remote tag', async () => {
        const git = {
            tag: vi.fn().mockResolvedValue('Deleted tag'),
            push: vi.fn().mockResolvedValue({deleted: true}),
        }

        await expect(deleteGitTag({git, tagName: 'staging-1.0.0-test'})).resolves.toBe(true)

        expect(git.tag).toHaveBeenCalledWith(['-d', 'staging-1.0.0-test'])
        expect(git.push).toHaveBeenCalledWith('origin', ':staging-1.0.0-test')
    })

    test('accepts a missing remote tag after deleting the local tag', async () => {
        const git = {
            tag: vi.fn().mockResolvedValue('Deleted tag'),
            push: vi.fn().mockRejectedValue(new Error("error: unable to delete 'staging-1.0.0-test': remote ref does not exist")),
        }

        await expect(deleteGitTag({git, tagName: 'staging-1.0.0-test'})).resolves.toBe(false)
    })
})
