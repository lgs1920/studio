/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-widget-guides.test.jsx
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

import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {proxy} from 'valtio'
import {proxyMap} from 'valtio/utils'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {VIDEO_WIDGETS_BOARD} from '@Core/constants'
import {ReplayWidgetGuides} from '@Components/MainUI/video/ReplayWidgetGuides'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
}))

const boardRect = {
    left: 100,
    top: 50,
    right: 400,
    bottom: 250,
    width: 300,
    height: 200,
}

describe('ReplayWidgetGuides', () => {
    let board
    let journey

    beforeEach(() => {
        globalThis.ResizeObserver = class {
            observe = vi.fn()
            disconnect = vi.fn()
        }
        board = document.createElement('div')
        board.getBoundingClientRect = vi.fn(() => boardRect)
        document.body.appendChild(board)
        journey = proxy({
            slug: 'test-journey',
            replay: {expert: {alignmentGuides: []}},
            persistToDatabase: vi.fn(() => Promise.resolve()),
        })
        globalThis.lgs = {
            settings: {
                ui: proxy({
                    replay: {userMode: 'expert'},
                    widgets: {grid: {enabled: false, snap: true, size: 30}},
                }),
            },
            stores: {
                main: proxy({theJourney: journey}),
                replay: proxy({
                    recordingSync: true,
                    basicPreparationActive: false,
                    alignmentGuides: [],
                    guidePlacementOrientation: null,
                }),
                ui: proxy({
                    video: {editing: true},
                    widget: {list: proxyMap()},
                }),
            },
        }
        globalThis.__ = {
            ui: {
                widgetManager: {
                    resolveWidgetsBoardContainer: vi.fn(boardId => boardId === VIDEO_WIDGETS_BOARD ? board : null),
                },
            },
        }
    })

    afterEach(() => {
        cleanup()
        document.body.innerHTML = ''
        vi.restoreAllMocks()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('places guides in the crop and persists block, unblock, and remove actions', async () => {
        render(<ReplayWidgetGuides/>)
        await waitFor(() => expect(document.querySelector('.replay-widget-guides-overlay')).not.toBeNull())

        lgs.stores.replay.guidePlacementOrientation = 'vertical'
        const overlay = document.querySelector('.replay-widget-guides-overlay')
        await waitFor(() => expect(overlay.classList.contains('is-placing')).toBe(true))
        fireEvent.click(overlay, {clientX: 160, clientY: 100})

        await waitFor(() => expect(screen.getByRole('button', {name: 'Vertical guide'})).not.toBeNull())
        expect(journey.replay.expert.alignmentGuides).toEqual([
            expect.objectContaining({orientation: 'vertical', position: 0.1, blocked: false}),
        ])
        expect(journey.persistToDatabase).toHaveBeenCalledOnce()

        const guideButton = screen.getByRole('button', {name: 'Vertical guide'})
        fireEvent.pointerDown(guideButton, {pointerId: 1, button: 0, clientX: 160, clientY: 100})
        fireEvent.pointerMove(guideButton, {pointerId: 1, clientX: 245, clientY: 100})
        fireEvent.pointerUp(guideButton, {pointerId: 1, clientX: 245, clientY: 100})
        await waitFor(() => expect(journey.replay.expert.alignmentGuides[0].position).toBe(0.5))

        fireEvent.contextMenu(screen.getByRole('button', {name: 'Vertical guide'}), {clientX: 180, clientY: 90})
        const contextMenu = screen.getByRole('menu', {name: 'Guide actions'})
        expect(contextMenu.classList.contains('lgs-context-menu')).toBe(true)
        expect(contextMenu.querySelector('ul > li [data-icon="lock"]')).not.toBeNull()
        expect(contextMenu.querySelector('ul > li span:last-child').textContent).toBe('Block')
        const blockAction = screen.getByRole('menuitem', {name: 'Block'})
        const removeAction = screen.getByRole('menuitem', {name: 'Remove'})
        expect(document.activeElement).toBe(blockAction)
        fireEvent.keyDown(blockAction, {key: 'ArrowDown'})
        expect(document.activeElement).toBe(removeAction)
        fireEvent.keyDown(removeAction, {key: 'ArrowUp'})
        expect(document.activeElement).toBe(blockAction)
        fireEvent.keyDown(blockAction, {key: 'Enter'})
        await waitFor(() => expect(journey.replay.expert.alignmentGuides[0].blocked).toBe(true))

        const blockedGuide = screen.getByRole('button', {name: 'Vertical guide, blocked'})
        fireEvent.pointerDown(blockedGuide, {pointerId: 2, button: 0, clientX: 250, clientY: 100})
        fireEvent.pointerMove(blockedGuide, {pointerId: 2, clientX: 350, clientY: 100})
        fireEvent.pointerUp(blockedGuide, {pointerId: 2, clientX: 350, clientY: 100})
        expect(journey.replay.expert.alignmentGuides[0].position).toBe(0.5)

        fireEvent.contextMenu(blockedGuide, {clientX: 180, clientY: 90})
        fireEvent.click(screen.getByRole('menuitem', {name: 'Unblock'}))
        await waitFor(() => expect(journey.replay.expert.alignmentGuides[0].blocked).toBe(false))

        fireEvent.contextMenu(screen.getByRole('button', {name: 'Vertical guide'}), {clientX: 180, clientY: 90})
        fireEvent.click(screen.getByRole('menuitem', {name: 'Remove'}))
        await waitFor(() => expect(journey.replay.expert.alignmentGuides).toEqual([]))
        expect(journey.persistToDatabase).toHaveBeenCalledTimes(5)
    })

    it('restores saved Expert guides when the journey preparation opens', async () => {
        journey.replay.expert.alignmentGuides = [
            {id: 'saved-guide', orientation: 'horizontal', position: 0.65, blocked: true},
        ]

        render(<ReplayWidgetGuides/>)

        const guide = await screen.findByRole('button', {name: 'Horizontal guide, blocked'})
        expect(guide.style.top).toBe('65%')
        expect(lgs.stores.replay.alignmentGuides).toEqual([
            {id: 'saved-guide', orientation: 'horizontal', position: 0.65, blocked: true},
        ])
    })

    it('uses native resize cursors with centered axis-specific activation points', async () => {
        journey.replay.expert.alignmentGuides = [
            {id: 'movable-guide', orientation: 'horizontal', position: 0.4, blocked: false},
            {id: 'second-guide', orientation: 'vertical', position: 0.6, blocked: false},
            {id: 'blocked-guide', orientation: 'horizontal', position: 0.7, blocked: true},
        ]

        render(<ReplayWidgetGuides/>)

        const horizontalGuide = await screen.findByRole('button', {name: 'Horizontal guide'})
        const verticalGuide = screen.getByRole('button', {name: 'Vertical guide'})
        const blockedGuide = screen.getByRole('button', {name: 'Horizontal guide, blocked'})

        expect(horizontalGuide.style.cursor).toBe('ns-resize')
        expect(verticalGuide.style.cursor).toBe('ew-resize')
        expect(blockedGuide.style.cursor).toBe('context-menu')
        expect(document.querySelector('.replay-widget-guide-drag-cursor')).toBeNull()
    })

    it('does not create another guide when its orientation has reached the limit', async () => {
        journey.replay.expert.alignmentGuides = Array.from({length: 20}, (_, index) => ({
            id: `vertical-${index}`,
            orientation: 'vertical',
            position: index / 20,
        }))

        render(<ReplayWidgetGuides/>)
        await waitFor(() => expect(document.querySelector('.replay-widget-guides-overlay')).not.toBeNull())

        lgs.stores.replay.guidePlacementOrientation = 'vertical'
        const overlay = document.querySelector('.replay-widget-guides-overlay')
        await waitFor(() => expect(overlay.classList.contains('is-placing')).toBe(true))
        fireEvent.click(overlay, {clientX: 160, clientY: 100})

        await waitFor(() => expect(overlay.classList.contains('is-placing')).toBe(false))
        expect(journey.replay.expert.alignmentGuides).toHaveLength(20)
    })
})
