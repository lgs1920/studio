import {describe, expect, test, vi} from 'vitest'
import {deleteGitTag, pushBranchWithRetry} from '../Deployment.js'

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
