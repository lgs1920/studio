// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fix-path-editor-panel-feedback.test.jsx
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
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, onClick, disabled, id, className, 'aria-label': ariaLabel}) => (
        <button type="button" onClick={onClick} disabled={disabled} id={id} className={className} aria-label={ariaLabel}>
            {children}
        </button>
    ),
    WaCallout: ({children, size, variant, appearance, open, role, 'aria-live': ariaLive, className}) => (
        <div
            className={className}
            data-testid="fix-path-callout"
            data-size={size}
            data-variant={variant}
            data-appearance={appearance}
            data-open={String(open)}
            role={role}
            aria-live={ariaLive}
        >
            {children}
        </div>
    ),
    WaIcon: ({name, slot, 'aria-hidden': ariaHidden}) => (
        <span data-icon={name} data-slot={slot} aria-hidden={ariaHidden}>{name}</span>
    ),
    WaInput: () => <input/>,
    WaNumberInput: () => <input type="number"/>,
    WaTooltip: ({children, for: target, placement}) => <wa-tooltip for={target} placement={placement}>{children}</wa-tooltip>,
}))

vi.mock('@Components/MainUI/LGSScrollbars', () => ({
    LGSScrollbars: ({children}) => <div>{children}</div>,
}))

import {FixPathCallout, FixPathEditorPanel} from '@Components/MainUI/FixPathEditorPanel'

const createPanelProps = feedback => ({
    activeCorrectionIndex: 0,
    activateSectionAt: () => {},
    areaMode: true,
    canRedo: false,
    canUndo: false,
    close: () => {},
    currentCorrectionVisible: false,
    displayedCorrection: null,
    displayedCorrectionPreview: null,
    displayedTrack: null,
    eraseMode: false,
    eraseSelectedControlPoints: () => {},
    feedback,
    focusJourney: () => {},
    handleCorrectionPointListKeyDown: () => {},
    handleCorrectionPointRowKeyDown: () => {},
    handleFixPathShortcut: () => {},
    helpOpen: false,
    heightUnit: 'm',
    onCorrectionVisibilityChange: () => {},
    orderedCorrections: [],
    persistCurrentDraftCorrections: () => {},
    projected: {sourcePoints: []},
    removeControlPoint: () => {},
    resetControlPoint: () => {},
    saving: false,
    scanProgress: null,
    selectCorrectionPoint: () => {},
    selectedControlPoints: [],
    selection: {phase: 'choose-start', startPoint: null, controlPoints: []},
    setHelpOpen: () => {},
    setEraseMode: () => {},
    setSelection: () => {},
    undoCorrectionEdit: () => {},
    redoCorrectionEdit: () => {},
    widgetResized: false,
    updateControlCoordinatePart: () => {},
})

describe('FixPathEditorPanel feedback callouts', () => {
    afterEach(cleanup)

    const findCalloutFor = text => screen.getByText(text).closest('[data-testid="fix-path-callout"]')

    it.each([
        {
            feedback: {type: 'warning', caption: 'Route section unavailable', text: 'Choose valid points on the same Journey segment.'},
            variant: 'warning',
            icon: 'triangle-exclamation',
            role: 'status',
            live: 'polite',
        },
        {
            feedback: {type: 'error', caption: 'Save failed', text: 'The corrections could not be saved.'},
            variant: 'danger',
            icon: 'circle-exclamation',
            role: 'alert',
            live: 'assertive',
        },
    ])('renders a small $variant callout with its matching icon', ({feedback, variant, icon, role, live}) => {
        render(<FixPathEditorPanel {...createPanelProps(feedback)}/>)

        const callout = findCalloutFor(feedback.caption)
        expect(callout.getAttribute('data-size')).toBe('s')
        expect(callout.getAttribute('data-variant')).toBe(variant)
        expect(callout.getAttribute('data-appearance')).toBe('outlined')
        expect(callout.getAttribute('data-open')).toBe('true')
        expect(callout.getAttribute('role')).toBe(role)
        expect(callout.getAttribute('aria-live')).toBe(live)
        expect(callout.textContent).toContain(feedback.caption)
        expect(callout.textContent).toContain(feedback.text)
        expect(callout.querySelector('[data-slot="icon"]')?.getAttribute('data-icon')).toBe(icon)
    })

    it('shows the selected point count in a small neutral callout', () => {
        render(<FixPathEditorPanel {...createPanelProps(null)} areaMode={false} selectedControlPoints={[{}, {}]}/>);

        const callout = findCalloutFor('2 correction points selected.')
        expect(callout.getAttribute('data-size')).toBe('s')
        expect(callout.getAttribute('data-variant')).toBe('neutral')
        expect(callout.getAttribute('role')).toBe('status')
        expect(callout.getAttribute('aria-live')).toBe('polite')
        expect(callout.querySelector('[data-slot="icon"]')?.getAttribute('data-icon')).toBe('circle-check')
    })

    it('lets the selection instruction close and shows it again after the status changes', () => {
        const baseProps = createPanelProps(null)
        const selectionInstruction = 'Shift or Alt draws a lasso; Ctrl+Shift or Ctrl+Alt draws a rectangle.'
        const {rerender} = render(<FixPathEditorPanel {...baseProps} areaMode={false}/>);

        fireEvent.click(screen.getByRole('button', {name: 'Dismiss selection instruction'}))
        expect(screen.queryByText(selectionInstruction)).toBeNull()

        rerender(<FixPathEditorPanel {...baseProps} areaMode={false} selectedControlPoints={[{}]}/>);
        expect(screen.getByText('1 correction point selected.')).toBeTruthy()

        rerender(<FixPathEditorPanel {...baseProps} areaMode={false}/>);
        expect(screen.getByText(selectionInstruction)).toBeTruthy()
        expect(screen.getByRole('button', {name: 'Dismiss selection instruction'})).toBeTruthy()
    })

    it('shows scan and save progress messages in small callouts', () => {
        render(<FixPathEditorPanel
            {...createPanelProps(null)}
            scanProgress={{phase: 'project', value: 40}}
            saving
        />)

        const scanCallout = findCalloutFor('Scanning Journey points: 40%')
        const saveCallout = findCalloutFor('Validating and applying Journey changes…')
        expect(scanCallout.getAttribute('data-size')).toBe('s')
        expect(scanCallout.querySelector('[data-slot="icon"]')?.getAttribute('data-icon')).toBe('magnifying-glass')
        expect(saveCallout.getAttribute('data-size')).toBe('s')
        expect(saveCallout.querySelector('[data-slot="icon"]')?.getAttribute('data-icon')).toBe('arrows-rotate')
    })

    it('shows the empty correction state in a small neutral callout', () => {
        render(<FixPathEditorPanel {...createPanelProps(null)}/>);

        const callout = findCalloutFor('No correction points yet.')
        expect(callout.getAttribute('data-size')).toBe('s')
        expect(callout.getAttribute('data-variant')).toBe('neutral')
        expect(callout.querySelector('[data-slot="icon"]')?.getAttribute('data-icon')).toBe('circle-info')
    })

    it('supports the filled on-map style for selection guidance', () => {
        render(<FixPathCallout className="fix-path-selection-guide" appearance="filled-outlined" icon="draw-polygon">
            {'Select points with the lasso.'}
        </FixPathCallout>);

        const callout = findCalloutFor('Select points with the lasso.')
        expect(callout.getAttribute('data-size')).toBe('s')
        expect(callout.getAttribute('data-appearance')).toBe('filled-outlined')
        expect(callout.querySelector('[data-slot="icon"]')?.getAttribute('data-icon')).toBe('draw-polygon')
    })

})
