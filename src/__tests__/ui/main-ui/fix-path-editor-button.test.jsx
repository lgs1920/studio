// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-editor-button.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-20
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {proxy} from 'valtio'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, onClick, disabled, id, className, size, appearance, 'aria-label': ariaLabel, 'aria-pressed': ariaPressed}) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            id={id}
            className={className}
            data-size={size}
            data-appearance={appearance}
            aria-label={ariaLabel}
            aria-pressed={ariaPressed}
        >
            {children}
        </button>
    ),
    WaIcon: ({name, variant, size}) => <span data-testid="fix-path-icon" data-icon={name} data-variant={variant} data-size={size}/>,
    WaTooltip: ({children, for: buttonId, placement}) => (
        <span data-testid="fix-path-tooltip" data-for={buttonId} data-placement={placement}>{children}</span>
    ),
}))

import {FixPathEditorButton} from '@Components/MainUI/FixPathEditorButton'

describe('FixPathEditorButton', () => {
    beforeEach(() => {
        globalThis.lgs = {
            stores: {
                journeyEditor: proxy({fixPathEditorOpen: false}),
            },
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
    })

    it('hides the main UI entry point when no Journey exists', () => {
        const {container} = render(<FixPathEditorButton journey={null} hideWhenUnavailable/>)

        expect(container.childElementCount).toBe(0)
    })

    it('toggles Fix Path for the current Journey and keeps its regular icon', () => {
        render(
            <FixPathEditorButton
                id="launch-fix-path-editor"
                className="square-button"
                journey={{slug: 'journey-a'}}
                hideWhenUnavailable
                tooltipPlacement="left"
                size="m"
                appearance="filled"
                showLabel={false}
            />,
        )

        const button = screen.getByRole('button', {name: 'Fix Path'})
        expect(button.classList.contains('square-button')).toBe(true)
        expect(button.dataset.size).toBe('m')
        expect(button.dataset.appearance).toBe('filled')
        expect(screen.getByTestId('fix-path-icon').dataset.icon).toBe('draw-polygon')
        expect(screen.getByTestId('fix-path-icon').dataset.variant).toBe('regular')
        expect(screen.getByTestId('fix-path-tooltip').dataset.placement).toBe('left')

        fireEvent.click(button)

        expect(lgs.stores.journeyEditor.fixPathEditorOpen).toBe(true)

        fireEvent.click(button)

        expect(lgs.stores.journeyEditor.fixPathEditorOpen).toBe(false)
    })

    it('keeps the Journey Settings entry disabled until a Journey is available', () => {
        render(<FixPathEditorButton journey={null}/>)

        expect(screen.getByRole('button', {name: 'Fix Path'}).disabled).toBe(true)
    })
})
