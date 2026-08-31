/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DrawerResizeHandle.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { DrawerResizeHandle } from '@Components/DrawerResizeHandle'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('DrawerResizeHandle', () => {
    let drawer

    beforeEach(() => {
        document.body.classList.remove('mobile')
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1280})
        drawer = document.createElement('wa-drawer')
        drawer.id = 'settings-drawer'
        drawer.getBoundingClientRect = vi.fn(() => ({
            left:   500,
            right:  948,
            top:    20,
            height: 700,
            width:  448,
        }))
        const dialog = document.createElement('dialog')
        dialog.setAttribute('part', 'dialog')
        drawer.attachShadow({mode: 'open'}).append(dialog)
        document.body.append(drawer)
    })

    afterEach(() => {
        cleanup()
        document.body.classList.remove('mobile')
        vi.useRealTimers()
    })

    it('resizes precisely and clamps pointer movement', () => {
        vi.useFakeTimers()
        render(
            <DrawerResizeHandle drawer={drawer} drawerId="settings-drawer" placement="end"/>,
        )
        const handle = drawer.shadowRoot.querySelector('[role="separator"]')
        expect(handle.style.width).toBe('5px')
        expect(handle.style.cursor).toBe('col-resize')
        handle.setPointerCapture = vi.fn()
        handle.releasePointerCapture = vi.fn()

        fireEvent.pointerDown(handle, {button: 0, clientX: 500, pointerId: 1, timeStamp: 0})
        expect(handle.style.cursor).toBe('col-resize')
        vi.advanceTimersByTime(300)
        fireEvent.pointerMove(handle, {clientX: 400, pointerId: 1, timeStamp: 100})
        fireEvent.pointerUp(handle, {clientX: 400, pointerId: 1, timeStamp: 300})

        expect(handle.getAttribute('aria-valuenow')).toBe('548')
        expect(drawer.style.getPropertyValue('--size')).toBe('548px')

        fireEvent.pointerDown(handle, {button: 0, clientX: 500, pointerId: 2, timeStamp: 400})
        vi.advanceTimersByTime(300)
        fireEvent.pointerMove(handle, {clientX: 0, pointerId: 2, timeStamp: 500})
        fireEvent.pointerUp(handle, {clientX: 0, pointerId: 2, timeStamp: 700})

        expect(handle.getAttribute('aria-valuenow')).toBe('720')
    })

    it('respects a drawer-specific maximum width', () => {
        render(
            <DrawerResizeHandle drawer={drawer} drawerId="settings-drawer" placement="end" resizeMax={560}/>,
        )
        const handle = drawer.shadowRoot.querySelector('[role="separator"]')

        fireEvent.keyDown(handle, {key: 'End'})

        expect(handle.getAttribute('aria-valuemax')).toBe('560')
        expect(handle.getAttribute('aria-valuenow')).toBe('560')
        expect(drawer.style.getPropertyValue('--size')).toBe('560px')
    })

    it('resolves a viewport-width maximum for a drawer', () => {
        Object.defineProperty(window, 'innerWidth', {configurable: true, value: 800})
        render(
            <DrawerResizeHandle drawer={drawer} drawerId="settings-drawer" placement="end" resizeMax="80vw"/>,
        )
        const handle = drawer.shadowRoot.querySelector('[role="separator"]')

        fireEvent.keyDown(handle, {key: 'End'})

        expect(handle.getAttribute('aria-valuemax')).toBe('640')
        expect(drawer.style.getPropertyValue('--size')).toBe('640px')
    })

    it('expands to the maximum after a fast outward gesture', () => {
        vi.useFakeTimers()
        render(
            <DrawerResizeHandle drawer={drawer} drawerId="settings-drawer" placement="end"/>,
        )
        const handle = drawer.shadowRoot.querySelector('[role="separator"]')
        handle.setPointerCapture = vi.fn()
        handle.releasePointerCapture = vi.fn()

        fireEvent.pointerDown(handle, {button: 0, clientX: 500, pointerId: 1, timeStamp: 0})
        vi.advanceTimersByTime(50)
        fireEvent.pointerMove(handle, {clientX: 400, pointerId: 1, timeStamp: 50})
        vi.advanceTimersByTime(50)
        fireEvent.pointerUp(handle, {clientX: 400, pointerId: 1, timeStamp: 100})

        expect(handle.getAttribute('aria-valuenow')).toBe('720')
        expect(drawer.classList.contains('drawer-resize-snapping')).toBe(true)

        vi.advanceTimersByTime(220)
        expect(drawer.classList.contains('drawer-resize-snapping')).toBe(false)
    })

    it('supports touch pointer input', () => {
        vi.useFakeTimers()
        render(
            <DrawerResizeHandle drawer={drawer} drawerId="settings-drawer" placement="end"/>,
        )
        const handle = drawer.shadowRoot.querySelector('[role="separator"]')
        handle.setPointerCapture = vi.fn()
        handle.releasePointerCapture = vi.fn()

        fireEvent.pointerDown(handle, {button: 0, clientX: 500, pointerId: 1, pointerType: 'touch'})
        vi.advanceTimersByTime(300)
        fireEvent.pointerMove(handle, {clientX: 450, pointerId: 1, pointerType: 'touch'})
        fireEvent.pointerUp(handle, {clientX: 450, pointerId: 1, pointerType: 'touch'})

        expect(drawer.style.getPropertyValue('--size')).toBe('498px')
    })

    it('fades the grab cue after two seconds', () => {
        vi.useFakeTimers()
        render(
            <DrawerResizeHandle drawer={drawer} drawerId="settings-drawer" placement="end"/>,
        )
        const handle = drawer.shadowRoot.querySelector('[role="separator"]')

        fireEvent.pointerEnter(handle)
        expect(handle.style.opacity).toBe('0.55')

        void act(() => vi.advanceTimersByTime(2000))
        expect(handle.style.opacity).toBe('0')
    })

    it('supports reset and keyboard resizing', () => {
        render(
            <DrawerResizeHandle drawer={drawer} drawerId="settings-drawer" placement="start"/>,
        )
        const handle = drawer.shadowRoot.querySelector('[role="separator"]')

        fireEvent.keyDown(handle, {key: 'ArrowRight'})
        expect(handle.getAttribute('aria-valuenow')).toBe('464')

        fireEvent.keyDown(handle, {key: 'ArrowRight', shiftKey: true})
        expect(handle.getAttribute('aria-valuenow')).toBe('528')

        fireEvent.keyDown(handle, {key: 'End'})
        expect(handle.getAttribute('aria-valuenow')).toBe('720')
        fireEvent.keyDown(handle, {key: 'Home'})
        expect(handle.getAttribute('aria-valuenow')).toBe('448')

        fireEvent.doubleClick(handle)
        expect(handle.getAttribute('aria-valuenow')).toBe('720')
        expect(drawer.style.getPropertyValue('--size')).toBe('720px')

        fireEvent.doubleClick(handle)
        expect(handle.getAttribute('aria-valuenow')).toBe('448')
        expect(drawer.style.getPropertyValue('--size')).toBe('448px')
    })

    it('does not expose the handle on mobile layouts', () => {
        document.body.classList.add('mobile')

        render(
            <DrawerResizeHandle drawer={drawer} drawerId="settings-drawer" placement="end"/>,
        )

        expect(drawer.shadowRoot.querySelector('[role="separator"]')).toBeNull()
    })
})
