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
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@awesome.me/webawesome/dist/react', () => ({
    WaButton: ({children, onClick, disabled, id, className, role, 'aria-label': ariaLabel, 'aria-checked': ariaChecked}) => (
        <button type="button" onClick={onClick} disabled={disabled} id={id} className={className} role={role} aria-label={ariaLabel} aria-checked={ariaChecked}>
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
    WaIcon: ({name, slot, variant, className, 'aria-hidden': ariaHidden}) => (
        <span data-icon={name} data-slot={slot} data-variant={variant} className={className} aria-hidden={ariaHidden}>{name}</span>
    ),
    WaInput: () => <input/>,
    WaNumberInput: () => <input type="number"/>,
    WaProgressBar: ({children, className, value, label}) => (
        <div
            className={className}
            role="progressbar"
            aria-valuenow={value}
            aria-label={label}
        >
            {children}
        </div>
    ),
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
    removeSelectedControlPoints: () => {},
    resetControlPoint: () => {},
    resetSelectedControlPoints: () => {},
    saving: false,
    scanProgress: null,
    selectCorrectionPoint: () => {},
    toggleDisplayedCorrectionPointSelection: () => {},
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

    it('shows bulk reset and remove actions only for multiple selected points', () => {
        const resetSelectedControlPoints = vi.fn()
        const removeSelectedControlPoints = vi.fn()
        const displayedCorrection = {
            id: 'section-1',
            trackSlug: 'track-1',
            segmentIndex: 0,
            startIndex: 0,
            endIndex: 1,
            controlPoints: [
                {id: 'point-1', coordinate: [10, 20, 30], fixed: true},
                {id: 'point-2', coordinate: [11, 21, 31], fixed: false},
            ],
        }
        const baseProps = {
            ...createPanelProps(null),
            areaMode: false,
            displayedCorrection,
            displayedTrack: {content: {geometry: {type: 'LineString', coordinates: [[10, 20, 30], [11, 21, 31]]}}},
            resetSelectedControlPoints,
            removeSelectedControlPoints,
            selectedControlPoints: [
                {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'point-1'},
                {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'point-2'},
            ],
        }
        const {rerender} = render(<FixPathEditorPanel {...baseProps}/>);

        const bulkResetButton = screen.getByRole('button', {name: 'Reset selected correction points'})
        const bulkRemoveButton = screen.getByRole('button', {name: 'Remove selected correction points'})
        expect(bulkResetButton.disabled).toBe(false)
        expect(bulkRemoveButton.disabled).toBe(false)
        expect(document.querySelector('.fix-path-coordinate-header-actions')).not.toBeNull()
        expect(screen.getAllByRole('button', {name: 'Reset correction point'}).every(button => button.disabled)).toBe(true)
        expect(screen.getAllByRole('button', {name: 'Remove correction point'}).every(button => button.disabled)).toBe(true)

        fireEvent.click(bulkResetButton)
        fireEvent.click(bulkRemoveButton)
        expect(resetSelectedControlPoints).toHaveBeenCalledOnce()
        expect(removeSelectedControlPoints).toHaveBeenCalledOnce()

        rerender(<FixPathEditorPanel {...baseProps} selectedControlPoints={[baseProps.selectedControlPoints[0]]}/>);
        expect(screen.queryByRole('button', {name: 'Reset selected correction points'})).toBeNull()
        expect(screen.queryByRole('button', {name: 'Remove selected correction points'})).toBeNull()

        const firstRow = document.querySelector('[data-control-point-id="point-1"]')
        expect(within(firstRow).getByRole('button', {name: 'Reset correction point'}).disabled).toBe(false)
        expect(within(firstRow).getByRole('button', {name: 'Remove correction point'}).disabled).toBe(false)
    })

    it('toggles all visible correction points from the status column header', () => {
        const toggleDisplayedCorrectionPointSelection = vi.fn()
        const displayedCorrection = {
            id: 'section-1',
            trackSlug: 'track-1',
            segmentIndex: 0,
            startIndex: 0,
            endIndex: 1,
            controlPoints: [
                {id: 'point-1', coordinate: [10, 20, 30], fixed: true},
                {id: 'point-2', coordinate: [11, 21, 31], fixed: false},
                {id: 'point-3', coordinate: [12, 22, 32], fixed: false, removed: true},
            ],
        }
        const baseProps = {
            ...createPanelProps(null),
            areaMode: false,
            displayedCorrection,
            displayedTrack: {content: {geometry: {type: 'LineString', coordinates: [[10, 20, 30], [11, 21, 31], [12, 22, 32]]}}},
            toggleDisplayedCorrectionPointSelection,
        }
        const {rerender} = render(<FixPathEditorPanel {...baseProps}/>);

        const selectAllCheckbox = screen.getByRole('checkbox', {name: 'Select all correction points'})
        expect(selectAllCheckbox.getAttribute('aria-checked')).toBe('false')
        expect(selectAllCheckbox.checked).toBe(false)
        expect(selectAllCheckbox.indeterminate).toBe(false)
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-icon')).toBe('square')
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-variant')).toBe('regular')
        expect(selectAllCheckbox.closest('.fix-path-coordinate-status-header-slot')).not.toBeNull()
        expect(selectAllCheckbox.closest('.fix-path-coordinate-header')).not.toBeNull()
        fireEvent.click(selectAllCheckbox)
        expect(toggleDisplayedCorrectionPointSelection).toHaveBeenCalledOnce()

        rerender(<FixPathEditorPanel
            {...baseProps}
            selectedControlPoints={[
                {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'point-1'},
            ]}
        />)

        const selectRemainingCheckbox = screen.getByRole('checkbox', {name: 'Select all correction points'})
        expect(selectRemainingCheckbox.getAttribute('aria-checked')).toBe('mixed')
        expect(selectRemainingCheckbox.checked).toBe(false)
        expect(selectRemainingCheckbox.indeterminate).toBe(true)
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-icon')).toBe('square-full')
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-variant')).toBe('solid')
        fireEvent.click(selectRemainingCheckbox)
        expect(toggleDisplayedCorrectionPointSelection).toHaveBeenCalledTimes(2)

        rerender(<FixPathEditorPanel
            {...baseProps}
            selectedControlPoints={[
                {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'point-1'},
                {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'point-2'},
            ]}
        />)

        const selectAllIncludingRemovedCheckbox = screen.getByRole('checkbox', {name: 'Select all correction points'})
        expect(selectAllIncludingRemovedCheckbox.getAttribute('aria-checked')).toBe('mixed')
        expect(selectAllIncludingRemovedCheckbox.checked).toBe(false)
        expect(selectAllIncludingRemovedCheckbox.indeterminate).toBe(true)
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-icon')).toBe('square-full')
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-variant')).toBe('solid')
        rerender(<FixPathEditorPanel
            {...baseProps}
            selectedControlPoints={[
                {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'point-1'},
                {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'point-2'},
                {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'point-3'},
            ]}
        />)
        const deselectAllCheckbox = screen.getByRole('checkbox', {name: 'Select all correction points'})
        expect(deselectAllCheckbox.getAttribute('aria-checked')).toBe('true')
        expect(deselectAllCheckbox.checked).toBe(true)
        expect(deselectAllCheckbox.indeterminate).toBe(false)
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-icon')).toBe('square-check')
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-variant')).toBe('regular')
        fireEvent.click(deselectAllCheckbox)
        expect(toggleDisplayedCorrectionPointSelection).toHaveBeenCalledTimes(3)
        rerender(<FixPathEditorPanel
            {...baseProps}
            selectedControlPoints={[
                {trackSlug: 'track-1', correctionId: 'section-1', controlPointId: 'point-1'},
            ]}
        />)
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-icon')).toBe('square-full')
        expect(document.querySelector('.fix-path-select-all-indicator')?.getAttribute('data-variant')).toBe('solid')
    })

    it('keeps global selection enabled when every visible point is removed', () => {
        const displayedCorrection = {
            id: 'section-removed',
            trackSlug: 'track-1',
            segmentIndex: 0,
            startIndex: 0,
            endIndex: 0,
            controlPoints: [{id: 'removed-point', coordinate: [10, 20, 30], fixed: false, removed: true}],
        }
        const toggleDisplayedCorrectionPointSelection = vi.fn()
        render(<FixPathEditorPanel
            {...createPanelProps(null)}
            areaMode={false}
            displayedCorrection={displayedCorrection}
            displayedTrack={{content: {geometry: {type: 'LineString', coordinates: [[10, 20, 30]]}}}}
            toggleDisplayedCorrectionPointSelection={toggleDisplayedCorrectionPointSelection}
        />)

        const selectAllCheckbox = screen.getByRole('checkbox', {name: 'Select all correction points'})
        expect(selectAllCheckbox.disabled).toBe(false)
        expect(selectAllCheckbox.getAttribute('aria-checked')).toBe('false')
        fireEvent.click(selectAllCheckbox)
        expect(toggleDisplayedCorrectionPointSelection).toHaveBeenCalledOnce()
    })

    it('lets the selection instruction close and shows it again after the status changes', () => {
        const baseProps = createPanelProps(null)
        const selectionInstruction = 'Shift or Alt draws a lasso; Ctrl+Shift or Ctrl+Alt draws a rectangle.'
        const {rerender} = render(<FixPathEditorPanel {...baseProps} areaMode={false}/>);

        expect(findCalloutFor(selectionInstruction).classList.contains('wa-theme-lgs1920-on-map')).toBe(true)

        fireEvent.click(screen.getByRole('button', {name: 'Dismiss selection instruction'}))
        expect(screen.queryByText(selectionInstruction)).toBeNull()

        rerender(<FixPathEditorPanel {...baseProps} areaMode={false} selectedControlPoints={[{}]}/>);
        expect(screen.getByText('1 correction point selected.')).toBeTruthy()

        rerender(<FixPathEditorPanel {...baseProps} areaMode={false}/>);
        expect(screen.getByText(selectionInstruction)).toBeTruthy()
        expect(screen.getByRole('button', {name: 'Dismiss selection instruction'})).toBeTruthy()
    })

    it('shows scan progress in a branded bar and save progress in a small callout', () => {
        render(<FixPathEditorPanel
            {...createPanelProps(null)}
            scanProgress={{phase: 'project', value: 40}}
            saving
        />)

        const saveCallout = findCalloutFor('Validating and applying Journey changes…')
        const scanProgress = screen.getByRole('progressbar', {name: 'Scanning Journey points: 40%'})
        expect(screen.queryByText('Scanning Journey points: 40%', {selector: '.fix-path-status-callout'})).toBeNull()
        expect(scanProgress.getAttribute('aria-valuenow')).toBe('40')
        expect(scanProgress.classList.contains('fix-path-scan-progress')).toBe(true)
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
