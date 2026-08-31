/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-session-ownership.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-08-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'

import {
    beginReplaySessionOwnership,
    currentReplaySessionOwnership,
    invalidateReplaySessionOwnership,
    ownsReplaySession,
    releaseReplaySessionOwnership,
} from '@Core/ui/replay/ReplaySessionOwnership'

describe('ReplaySessionOwnership', () => {
    it('invalidates an older lifecycle when a new replay begins', () => {
        const owner = {}
        const first = beginReplaySessionOwnership(owner, {source: 'draft'})
        const second = beginReplaySessionOwnership(owner, {source: 'draft'})

        expect(first.id).not.toBe(second.id)
        expect(ownsReplaySession(owner, first)).toBe(false)
        expect(ownsReplaySession(owner, second)).toBe(true)
        expect(currentReplaySessionOwnership(owner)).toBe(second)
    })

    it('does not let stale cleanup release the active replay lifecycle', () => {
        const owner = {}
        const first = beginReplaySessionOwnership(owner)
        const second = beginReplaySessionOwnership(owner)

        expect(releaseReplaySessionOwnership(owner, first)).toBe(false)
        expect(ownsReplaySession(owner, second)).toBe(true)
        expect(releaseReplaySessionOwnership(owner, second)).toBe(true)
        expect(currentReplaySessionOwnership(owner)).toBeNull()
    })

    it('invalidates current ownership during terminal disposal', () => {
        const owner = {}
        const lease = beginReplaySessionOwnership(owner)

        expect(invalidateReplaySessionOwnership(owner)).toBe(true)
        expect(ownsReplaySession(owner, lease)).toBe(false)
        expect(invalidateReplaySessionOwnership(owner)).toBe(false)
    })
})
