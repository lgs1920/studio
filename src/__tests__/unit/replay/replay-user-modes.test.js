/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-user-modes.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-25
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    defaultSimpleReplaySettings,
    hasExpertReplayConfiguration,
    initializeExpertReplayFromSimple,
    normalizeReplayUserMode,
    resetExpertReplayFromSimple,
    resolveSimpleReplaySettings,
    REPLAY_USER_MODE_BASIC,
    REPLAY_USER_MODE_EXPERT,
} from '@Core/ui/replay/ReplayUserModes'
import {describe, expect, it} from 'vitest'

describe('Replay user modes', () => {
    it('defaults to Basic and normalizes unknown modes', () => {
        expect(normalizeReplayUserMode()).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode('unknown')).toBe(REPLAY_USER_MODE_BASIC)
        expect(normalizeReplayUserMode(REPLAY_USER_MODE_EXPERT)).toBe(REPLAY_USER_MODE_EXPERT)
    })

    it('resolves journey settings over user and product settings', () => {
        const product = defaultSimpleReplaySettings()
        const resolved = resolveSimpleReplaySettings({
            product,
            user: {camera: {altitude: 900}},
            journey: {camera: {heading: 45}},
        })

        expect(resolved.camera.altitude).toBe(900)
        expect(resolved.camera.heading).toBe(45)
        expect(resolved.camera.altitudeMode).toBe('constant')
    })

    it('initializes Expert once and preserves it on mode switches', () => {
        const simple = defaultSimpleReplaySettings()
        const journey = {replay: {start: [], stop: []}}
        const initialized = initializeExpertReplayFromSimple(journey, simple)
        const existing = {replay: {expert: {camera: {altitude: 500}}}}

        expect(hasExpertReplayConfiguration(journey)).toBe(false)
        expect(initialized.expert.camera.altitude).toBe(simple.camera.altitude)
        expect(initializeExpertReplayFromSimple(existing, simple)).toBe(existing.replay)
    })

    it('resets Expert only through the explicit reset operation', () => {
        const simple = defaultSimpleReplaySettings()
        const journey = {replay: {expert: {camera: {altitude: 500}, timeline: {zoomPercent: 50}}}}
        const reset = resetExpertReplayFromSimple(journey, simple)

        expect(reset.expert.camera.altitude).toBe(simple.camera.altitude)
        expect(reset.expert.timeline.zoomPercent).toBe(50)
    })
})
