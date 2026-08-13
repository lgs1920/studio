/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ShortcutManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-09
 * Last modified: 2026-05-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const EDITABLE_SELECTOR = [
    'input',
    'textarea',
    'select',
    'wa-input',
    'wa-number-input',
    'wa-textarea',
    'wa-select',
    'wa-combobox',
    'sl-input',
    'sl-textarea',
    'sl-select',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[data-lgs-shortcut-editable="true"]',
].join(', ')
const MODIFIER_ALIASES = {
    cmd:     'meta',
    command: 'meta',
    control: 'ctrl',
    ctl:     'ctrl',
    option:  'alt',
}
const KEY_ALIASES = {
    arrowsdown: 'arrowdown',
    arrowsleft: 'arrowleft',
    arrowsright: 'arrowright',
    arrowsup:   'arrowup',
    del:        'delete',
    down:       'arrowdown',
    esc:        'escape',
    left:       'arrowleft',
    plus:       '+',
    return:     'enter',
    right:      'arrowright',
    space:      ' ',
    spacebar:   ' ',
    up:         'arrowup',
}
const CODE_ALIASES = {
    ' ':       'space',
    arrowdown: 'arrowdown',
    arrowleft: 'arrowleft',
    arrowright: 'arrowright',
    arrowup:   'arrowup',
    backspace: 'backspace',
    delete:    'delete',
    enter:     'enter',
    escape:    'escape',
    tab:       'tab',
}
const MODIFIER_KEYS = new Set(['alt', 'ctrl', 'meta', 'shift'])
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'button',
    'details',
    'iframe',
    'input',
    'select',
    'summary',
    'textarea',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[tabindex]',
].join(',')

const isMacPlatform = () => {
    const platform = globalThis.navigator?.userAgentData?.platform ?? globalThis.navigator?.platform ?? ''
    return /mac|iphone|ipad|ipod/i.test(platform)
}

const normalizeKey = (value = '') => {
    const key = `${value}`.trim().toLowerCase()
    return KEY_ALIASES[key] ?? MODIFIER_ALIASES[key] ?? key
}

const normalizeEventKey = (event) => {
    if (event.key === ' ') {
        return ' '
    }
    return normalizeKey(event.key)
}

const normalizeEventCode = event => `${event.code ?? ''}`.trim().toLowerCase()

const codeForKey = (key) => {
    if (/^[a-z]$/.test(key)) {
        return `key${key}`
    }
    if (/^[0-9]$/.test(key)) {
        return `digit${key}`
    }
    return CODE_ALIASES[key] ?? ''
}

const normalizeShortcut = (shortcut) => {
    const raw = `${shortcut ?? ''}`.trim()
    if (!raw) {
        throw new Error('Shortcut must be a non-empty string')
    }

    const parts = raw.split('+').map(part => part.trim()).filter(Boolean)
    if (parts.length === 0) {
        throw new Error('Shortcut must include a key')
    }

    const modifiers = {
        alt:   false,
        ctrl:  false,
        meta:  false,
        shift: false,
    }
    let key = ''

    parts.forEach((part) => {
        const normalized = normalizeKey(part)
        if (normalized === 'mod') {
            modifiers[isMacPlatform() ? 'meta' : 'ctrl'] = true
            return
        }
        if (MODIFIER_KEYS.has(normalized)) {
            modifiers[normalized] = true
            return
        }
        key = normalized
    })

    if (!key) {
        throw new Error(`Shortcut "${raw}" must include a non-modifier key`)
    }

    return {raw, code: codeForKey(key), key, modifiers}
}

const eventMatchesShortcut = (event, shortcut) => {
    const keyMatches = normalizeEventKey(event) === shortcut.key
    const codeMatches = shortcut.code && normalizeEventCode(event) === shortcut.code

    return (keyMatches || codeMatches)
           && event.altKey === shortcut.modifiers.alt
           && event.ctrlKey === shortcut.modifiers.ctrl
           && event.metaKey === shortcut.modifiers.meta
           && event.shiftKey === shortcut.modifiers.shift
}

const resolveTarget = (target) => {
    const HTMLElementClass = globalThis.HTMLElement
    if (target?.current) {
        return target.current
    }
    if (typeof target === 'string') {
        return globalThis.document?.querySelector(target) ?? null
    }
    if (target === globalThis.window || target === globalThis.document) {
        return target
    }
    if (HTMLElementClass && target instanceof HTMLElementClass) {
        return target
    }
    return null
}

const isEditableTarget = (target) => {
    const ElementClass = globalThis.Element
    return ElementClass && target instanceof ElementClass && Boolean(target.closest(EDITABLE_SELECTOR))
}

const isEditableEventTarget = (event) => {
    if (isEditableTarget(event?.target)) {
        return true
    }

    const path = event?.composedPath?.() ?? []
    return path.some(node => isEditableTarget(node))
}

const isFocusable = (element) => {
    const HTMLElementClass = globalThis.HTMLElement
    if (!HTMLElementClass || !(element instanceof HTMLElementClass)) {
        return false
    }
    if (element.matches(FOCUSABLE_SELECTOR)) {
        return true
    }
    return typeof element.tabIndex === 'number' && element.tabIndex >= 0
}

export class ShortcutManager {

    #bindings = new Set()

    addShortcut = (target, shortcut, callback, options = {}) => {
        const element = resolveTarget(target)
        if (!element) {
            throw new Error('addShortcut expects an HTMLElement, document, window, selector, or React ref')
        }
        if (typeof callback !== 'function') {
            throw new Error('Shortcut callback must be a function')
        }

        const shortcuts = (Array.isArray(shortcut) ? shortcut : [shortcut]).map(normalizeShortcut)
        const binding = {
            callback,
            element,
            listener: null,
            options:  {
                allowInEditable: options.allowInEditable ?? false,
                capture:         options.capture ?? true,
                focusOnPointerDown: options.focusOnPointerDown ?? true,
                preventDefault:  options.preventDefault ?? true,
                repeat:          options.repeat ?? false,
                stopPropagation: options.stopPropagation ?? false,
            },
            pointerListener: null,
            restoreTabIndex: null,
            shortcuts,
        }

        binding.listener = (event) => {
            if (!binding.options.repeat && event.repeat) {
                return
            }
            if (!binding.options.allowInEditable && isEditableEventTarget(event) && event.target !== element) {
                return
            }

            const matchedShortcut = shortcuts.find(candidate => eventMatchesShortcut(event, candidate))
            if (!matchedShortcut) {
                return
            }

            if (binding.options.preventDefault) {
                event.preventDefault()
            }
            if (binding.options.stopPropagation) {
                event.stopPropagation()
                event.stopImmediatePropagation?.()
            }

            callback(event, {
                element,
                manager: this,
                normalized: matchedShortcut,
                remove:    () => this.#removeBinding(binding),
                shortcut:  matchedShortcut.raw,
            })
        }

        element.addEventListener('keydown', binding.listener, {capture: binding.options.capture})
        this.#installFocusBridge(binding)
        this.#bindings.add(binding)

        const remove = () => this.#removeBinding(binding)
        remove.binding = binding
        return remove
    }

    removeShortcut = (removeOrBinding) => {
        if (typeof removeOrBinding === 'function' && removeOrBinding.binding) {
            this.#removeBinding(removeOrBinding.binding)
            return
        }
        this.#removeBinding(removeOrBinding)
    }

    removeShortcutsFor = (target) => {
        const element = resolveTarget(target)
        if (!element) {
            return
        }

        Array.from(this.#bindings)
            .filter(binding => binding.element === element)
            .forEach(binding => this.#removeBinding(binding))
    }

    clear = () => {
        Array.from(this.#bindings).forEach(binding => this.#removeBinding(binding))
    }

    destroy = () => {
        this.clear()
    }

    #installFocusBridge = (binding) => {
        const {element, options} = binding
        const HTMLElementClass = globalThis.HTMLElement
        if (!HTMLElementClass || !(element instanceof HTMLElementClass) || !options.focusOnPointerDown) {
            return
        }

        if (!isFocusable(element)) {
            const previous = element.getAttribute('tabindex')
            element.setAttribute('tabindex', '-1')
            binding.restoreTabIndex = () => {
                if (previous === null) {
                    element.removeAttribute('tabindex')
                    return
                }
                element.setAttribute('tabindex', previous)
            }
        }

        binding.pointerListener = (event) => {
            if (isEditableEventTarget(event)) {
                return
            }
            if (!element.contains(globalThis.document?.activeElement)) {
                element.focus({preventScroll: true})
            }
        }

        element.addEventListener('pointerdown', binding.pointerListener, {capture: true})
    }

    #removeBinding = (binding) => {
        if (!binding || !this.#bindings.has(binding)) {
            return
        }

        binding.element.removeEventListener('keydown', binding.listener, {capture: binding.options.capture})
        if (binding.pointerListener) {
            binding.element.removeEventListener('pointerdown', binding.pointerListener, {capture: true})
        }
        if (binding.restoreTabIndex) {
            const nextBindingForElement = Array.from(this.#bindings)
                .find(candidate => candidate !== binding && candidate.element === binding.element)

            if (nextBindingForElement && !nextBindingForElement.restoreTabIndex) {
                nextBindingForElement.restoreTabIndex = binding.restoreTabIndex
            }
            else {
                binding.restoreTabIndex()
            }
        }
        this.#bindings.delete(binding)
    }
}

export const addShortcut = (...args) => {
    if (!globalThis.__?.ui?.shortcutManager) {
        throw new Error('ShortcutManager is not initialized')
    }
    return globalThis.__.ui.shortcutManager.addShortcut(...args)
}
