/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-widget-guide-utils.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-22
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {
    journeyReplayExpertWidgetGuides,
    normalizeReplayWidgetGuides,
    nextReplayWidgetGuidePosition,
    replayWidgetGuidePositionFromPointer,
    snapReplayWidgetGuidePosition,
    syncJourneyReplayExpertWidgetGuides,
} from '@Core/ui/replay/ReplayWidgetGuideUtils'

describe('Replay widget guide utilities', () => {
    it('normalizes supported orientations, crop-relative positions, and blocked state', () => {
        expect(normalizeReplayWidgetGuides([
            {id: 'guide-a', orientation: 'vertical', position: 1.5, blocked: true},
            {id: 'guide-b', orientation: 'horizontal', position: -0.5},
            {id: 'invalid', orientation: 'diagonal', position: 0.5},
            {id: 'invalid-position', orientation: 'vertical', position: Number.NaN},
        ])).toEqual([
            {id: 'guide-a', orientation: 'vertical', position: 1, blocked: true},
            {id: 'guide-b', orientation: 'horizontal', position: 0, blocked: false},
        ])
    })

    it('assigns default guide positions by orientation and enforces the per-orientation limit', () => {
        const guides = []
        const verticalPositions = []

        for (let index = 0; index < 20; index += 1) {
            const position = nextReplayWidgetGuidePosition('vertical', guides)
            expect(position).not.toBeNull()
            verticalPositions.push(position)
            guides.push({id: `vertical-${index}`, orientation: 'vertical', position})
        }

        expect(verticalPositions.slice(0, 10)).toEqual([
            0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15,
        ])
        expect(verticalPositions.slice(18)).toEqual([0.05, 0.98])
        expect(nextReplayWidgetGuidePosition('vertical', guides)).toBeNull()
        expect(nextReplayWidgetGuidePosition('horizontal', guides)).toBe(0.1)

        const overLimit = [
            ...guides,
            {id: 'vertical-over-limit', orientation: 'vertical', position: 0.5},
            ...Array.from({length: 22}, (_, index) => ({
                id: `horizontal-${index}`,
                orientation: 'horizontal',
                position: index / 22,
            })),
        ]
        const normalized = normalizeReplayWidgetGuides(overLimit)
        expect(normalized).toHaveLength(40)
        expect(normalized.filter(guide => guide.orientation === 'vertical')).toHaveLength(20)
        expect(normalized.filter(guide => guide.orientation === 'horizontal')).toHaveLength(20)
    })

    it('reads and persists guides without replacing other Expert settings', () => {
        const persistToDatabase = vi.fn(() => Promise.resolve())
        const journey = {
            slug: 'alpine-route',
            replay: {expert: {camera: {mode: 'ahead'}, alignmentGuides: [{id: 'guide-a', orientation: 'vertical', position: 0.25}]}},
            persistToDatabase,
        }
        const guides = journeyReplayExpertWidgetGuides(journey)

        syncJourneyReplayExpertWidgetGuides([...guides, {id: 'guide-b', orientation: 'horizontal', position: 0.75}], journey)

        expect(journey.replay.expert.camera).toEqual({mode: 'ahead'})
        expect(journey.replay.expert.alignmentGuides).toEqual([
            {id: 'guide-a', orientation: 'vertical', position: 0.25, blocked: false},
            {id: 'guide-b', orientation: 'horizontal', position: 0.75, blocked: false},
        ])
        expect(persistToDatabase).toHaveBeenCalledOnce()
    })

    it('converts pointer coordinates to clamped crop-relative positions', () => {
        const rect = {left: 100, top: 50, width: 300, height: 200}

        expect(replayWidgetGuidePositionFromPointer('vertical', 250, rect)).toBe(0.5)
        expect(replayWidgetGuidePositionFromPointer('horizontal', 0, rect)).toBe(0)
        expect(replayWidgetGuidePositionFromPointer('horizontal', 400, rect)).toBe(1)
    })

    it('snaps guides to widget alignment points and enabled grid lines', () => {
        const rect = {left: 100, top: 50, right: 400, bottom: 250, width: 300, height: 200}

        expect(snapReplayWidgetGuidePosition({
            orientation: 'horizontal',
            position: 0.32,
            rect,
            widgetRects: [{left: 120, top: 110, right: 200, bottom: 130, width: 80, height: 20}],
        })).toBe(0.3)

        expect(snapReplayWidgetGuidePosition({
            orientation: 'vertical',
            position: 0.41,
            rect,
            grid: {enabled: true, snap: true, size: 30},
        })).toBe(0.4)
    })
})
