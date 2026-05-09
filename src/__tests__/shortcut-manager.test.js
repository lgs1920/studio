/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: shortcut-manager.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JSDOM }                               from 'jsdom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addShortcut, ShortcutManager }        from '../core/events/ShortcutManager'

let manager

if (!globalThis.document) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>')
    globalThis.window = dom.window
    globalThis.document = dom.window.document
    globalThis.Element = dom.window.Element
    globalThis.HTMLElement = dom.window.HTMLElement
    globalThis.KeyboardEvent = dom.window.KeyboardEvent
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value:        dom.window.navigator,
    })
}

const dispatchKey = (target, key, options = {}) => {
    const event = new KeyboardEvent('keydown', {
        bubbles:    true,
        cancelable: true,
        key,
        ...options,
    })
    target.dispatchEvent(event)
    return event
}

describe('ShortcutManager', () => {
    afterEach(() => {
        manager?.destroy()
        manager = null
        document.body.innerHTML = ''
        delete globalThis.__
    })

    it('runs a shortcut callback for a DOM element', () => {
        const element = document.createElement('div')
        const callback = vi.fn()
        document.body.append(element)
        manager = new ShortcutManager()

        manager.addShortcut(element, 'Ctrl+K', callback)
        const event = dispatchKey(element, 'k', {ctrlKey: true})

        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith(event, expect.objectContaining({
            element,
            shortcut: 'Ctrl+K',
        }))
        expect(event.defaultPrevented).toBe(true)
    })

    it('accepts a React ref and restores a temporary tabindex on cleanup', () => {
        const element = document.createElement('section')
        const callback = vi.fn()
        document.body.append(element)
        manager = new ShortcutManager()

        const remove = manager.addShortcut({current: element}, 'Escape', callback)

        expect(element.getAttribute('tabindex')).toBe('-1')

        dispatchKey(element, 'Escape')
        expect(callback).toHaveBeenCalledTimes(1)

        remove()
        expect(element.hasAttribute('tabindex')).toBe(false)

        dispatchKey(element, 'Escape')
        expect(callback).toHaveBeenCalledTimes(1)
    })

    it('supports multiple shortcuts for the same binding', () => {
        const element = document.createElement('button')
        const callback = vi.fn()
        document.body.append(element)
        manager = new ShortcutManager()

        manager.addShortcut(element, ['Enter', 'Space'], callback)

        dispatchKey(element, 'Enter')
        dispatchKey(element, ' ')
        dispatchKey(element, 'Escape')

        expect(callback).toHaveBeenCalledTimes(2)
    })

    it('matches physical letter codes when modifiers change the emitted key', () => {
        const element = document.createElement('div')
        const callback = vi.fn()
        document.body.append(element)
        manager = new ShortcutManager()

        manager.addShortcut(element, 'Alt+Shift+J', callback)

        dispatchKey(element, 'Ô', {
            altKey:   true,
            code:     'KeyJ',
            shiftKey: true,
        })

        expect(callback).toHaveBeenCalledTimes(1)
    })

    it('runs a window shortcut from a descendant keydown event', () => {
        const callback = vi.fn()
        document.body.innerHTML = '<main><button>Map action</button></main>'
        manager = new ShortcutManager()

        manager.addShortcut(window, 'Alt+Shift+R', callback, {
            focusOnPointerDown: false,
            stopPropagation:    true,
        })

        const event = dispatchKey(document.querySelector('button'), 'R', {
            altKey:   true,
            code:     'KeyR',
            shiftKey: true,
        })

        expect(callback).toHaveBeenCalledTimes(1)
        expect(event.defaultPrevented).toBe(true)
    })

    it('keeps the temporary tabindex while another binding remains on the same element', () => {
        const element = document.createElement('section')
        document.body.append(element)
        manager = new ShortcutManager()

        const removeFirst = manager.addShortcut(element, 'A', vi.fn())
        const removeSecond = manager.addShortcut(element, 'B', vi.fn())

        expect(element.getAttribute('tabindex')).toBe('-1')

        removeFirst()
        expect(element.getAttribute('tabindex')).toBe('-1')

        removeSecond()
        expect(element.hasAttribute('tabindex')).toBe(false)
    })

    it('ignores editable descendants unless explicitly allowed', () => {
        const element = document.createElement('div')
        const input = document.createElement('input')
        const callback = vi.fn()
        element.append(input)
        document.body.append(element)
        manager = new ShortcutManager()

        manager.addShortcut(element, 'Ctrl+K', callback)

        dispatchKey(input, 'k', {ctrlKey: true})
        expect(callback).not.toHaveBeenCalled()
    })

    it('ignores web component form controls such as wa-number-input', () => {
        const element = document.createElement('div')
        const input = document.createElement('wa-number-input')
        const callback = vi.fn()
        element.append(input)
        document.body.append(element)
        manager = new ShortcutManager()

        manager.addShortcut(window, 'Backspace', callback)

        dispatchKey(input, 'Backspace')
        expect(callback).not.toHaveBeenCalled()
    })

    it('exposes a global addShortcut helper when the app context is initialized', () => {
        const element = document.createElement('div')
        const callback = vi.fn()
        document.body.append(element)
        manager = new ShortcutManager()
        globalThis.__ = {ui: {shortcutManager: manager}}

        const remove = addShortcut(element, 'Alt+P', callback)
        dispatchKey(element, 'p', {altKey: true})

        expect(callback).toHaveBeenCalledTimes(1)
        remove()
    })
})
