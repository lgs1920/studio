/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FixPathEditorPanel.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {LGSScrollbars} from '@Components/MainUI/LGSScrollbars'
import {WaButton, WaIcon, WaInput, WaTooltip} from '@awesome.me/webawesome/dist/react'
import {getControlPointCoordinate} from './FixPathEditorGeometry'

/** Render Fix Path controls and the active section's editable point list. */
export const FixPathEditorPanel = ({
    activeCorrectionIndex,
    activateSectionAt,
    areaMode,
    close,
    deleteCorrectionSection,
    displayedCorrection,
    displayedCorrectionPreview,
    displayedTrack,
    handleCorrectionPointListKeyDown,
    handleCorrectionPointRowKeyDown,
    handleFixPathShortcut,
    helpOpen,
    orderedCorrections,
    projected,
    removeControlPoint,
    resetControlPoint,
    saving,
    scanProgress,
    selectCorrectionPoint,
    selectedControlPoints,
    selection,
    setHelpOpen,
    setSelection,
    updateControlCoordinatePart,
    validate,
}) => (
    <aside
        className="fix-path-panel lgs-card wa-theme-lgs1920-on-map"
        aria-label="Fix Path editor"
        onKeyDownCapture={handleFixPathShortcut}
    >
        <header className="fix-path-panel-header">
            <h2><WaIcon name="draw-polygon" variant="regular" aria-hidden="true"/>{'Fix Path'}</h2>
            <p className="fix-path-correction-selection-hint">
                <span className="fix-path-correction-selection-bracket">{'['}</span>
                <kbd className="lgs--shortcut-key">{'Shift'}</kbd>
                <span>{' + Drag to select points'}</span>
                <span className="fix-path-correction-selection-bracket">{']'}</span>
            </p>
            <div className="fix-path-panel-header-actions" aria-label="Actions">
                <WaTooltip for="fix-path-help-trigger" placement="top">{'Help'}</WaTooltip>
                <WaButton
                    id="fix-path-help-trigger"
                    className="lgs-widget-no-drag"
                    size="s"
                    appearance="plain"
                    variant="neutral"
                    aria-label="Help"
                    aria-haspopup="dialog"
                    aria-controls="fix-path-help-popup"
                    aria-expanded={helpOpen ? 'true' : 'false'}
                    onClick={() => setHelpOpen(isOpen => !isOpen)}
                >
                    <WaIcon name="question" variant="regular" aria-hidden="true"/>
                </WaButton>
                {orderedCorrections.length > 1 && (
                    <>
                        <WaTooltip for="fix-path-previous-section" placement="top">{'Previous section'}</WaTooltip>
                        <WaButton
                            id="fix-path-previous-section"
                            className="lgs-widget-no-drag"
                            size="s"
                            appearance="plain"
                            variant="neutral"
                            aria-label="Previous section"
                            onClick={() => activateSectionAt(activeCorrectionIndex - 1)}
                        >
                            <WaIcon name="chevron-left" variant="regular" aria-hidden="true"/>
                        </WaButton>
                        <WaTooltip for="fix-path-next-section" placement="top">{'Next section'}</WaTooltip>
                        <WaButton
                            id="fix-path-next-section"
                            className="lgs-widget-no-drag"
                            size="s"
                            appearance="plain"
                            variant="neutral"
                            aria-label="Next section"
                            onClick={() => activateSectionAt(activeCorrectionIndex + 1)}
                        >
                            <WaIcon name="chevron-right" variant="regular" aria-hidden="true"/>
                        </WaButton>
                    </>
                )}
                {displayedCorrection && selectedControlPoints.length >= 2 && (
                    <>
                        <WaTooltip for="fix-path-delete-section" placement="top">{'Delete section'}</WaTooltip>
                        <WaButton
                            id="fix-path-delete-section"
                            className="lgs-widget-no-drag"
                            size="s"
                            appearance="plain"
                            variant="danger"
                            aria-label="Delete active section"
                            onClick={() => deleteCorrectionSection(
                                displayedCorrection.trackSlug,
                                displayedCorrection.id,
                            )}
                        >
                            <WaIcon name="trash" variant="regular" aria-hidden="true"/>
                        </WaButton>
                    </>
                )}
                <WaButton className="lgs-widget-no-drag" size="s" appearance="plain" variant="neutral" aria-label="Close Fix Path editor" onClick={close}>
                    <WaIcon name="xmark" variant="regular"/>
                </WaButton>
            </div>
        </header>

        {(scanProgress || !areaMode) && (
            <p className="fix-path-status" aria-live="polite">
                {scanProgress
                    ? scanProgress.phase === 'project'
                        ? 'Scanning Journey points: ' + scanProgress.value + '%'
                        : 'Checking terrain visibility: ' + scanProgress.value + '%'
                    : selection.phase === 'choose-start'
                        ? selectedControlPoints.length > 1
                            ? selectedControlPoints.length + ' correction points selected.'
                            : projected.sourcePoints.length > 0
                                ? projected.sourcePoints.length + ' visible points selected.'
                                : 'No points found. Close and reopen Fix Path to select another screen area.'
                        : 'Adding points to correction.'}
            </p>
        )}

        {scanProgress && (
            <progress className="fix-path-scan-progress" max="100" value={scanProgress.value}>
                {scanProgress.value + '%'}
            </progress>
        )}

        {selection.phase === 'add-points' && (
            <div className="fix-path-area-actions">
                <WaButton
                    className="lgs-widget-no-drag"
                    size="s"
                    appearance="plain"
                    variant="neutral"
                    onClick={() => setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})}
                >
                    {'Cancel section'}
                </WaButton>
            </div>
        )}

        <div className="fix-path-corrections-scroll-area">
            <div className="fix-path-corrections-list" aria-label="Correction points">
                {!displayedCorrection && <p>{'No correction points yet.'}</p>}
                {displayedCorrection && (
                    <section className="fix-path-correction-section" key={displayedCorrection.id}>
                        <div className="fix-path-coordinate-header" aria-hidden="true">
                            <span>{'Lat'}</span>
                            <span>{'Lon'}</span>
                            <span>{'Height'}</span>
                            <span/>
                        </div>
                        <div className="fix-path-correction-points-scroll-area">
                            <LGSScrollbars
                                autoHeight
                                autoHeightMax="min(var(--fix-path-correction-list-max-height), max(0px, calc(100vh - 13rem)))"
                            >
                                <div
                                    className="fix-path-correction-points-list"
                                    onKeyDownCapture={handleCorrectionPointListKeyDown}
                                >
                                    {displayedCorrection.controlPoints.map(point => {
                                        const coordinate = getControlPointCoordinate(
                                            displayedTrack?.content,
                                            displayedCorrection,
                                            point,
                                            displayedCorrectionPreview,
                                        )
                                        const selected = selectedControlPoints.some(item => item.trackSlug === displayedCorrection.trackSlug
                                            && item.controlPointId === point.id)
                                        const latitude = Number(coordinate[1])
                                        const longitude = Number(coordinate[0])
                                        const height = Number(coordinate[2])
                                        const removed = point.removed === true
                                        const resetButtonId = `fix-path-reset-${displayedCorrection.id}-${point.id}`
                                        const removeButtonId = `fix-path-remove-${displayedCorrection.id}-${point.id}`
                                        return (
                                            <div
                                                className={'fix-path-correction-point-row'
                                                    + (selected ? ' is-selected' : '')
                                                    + (point.fixed === true ? ' is-fixed' : '')
                                                    + (removed ? ' is-removed' : '')}
                                                key={point.id}
                                                role="group"
                                                tabIndex="0"
                                                data-control-point-id={point.id}
                                                aria-label={removed ? 'Removed correction point' : 'Correction point'}
                                                aria-current={selected ? 'true' : undefined}
                                                aria-keyshortcuts="ArrowUp ArrowDown PageUp PageDown"
                                                onClick={event => {
                                                    if (!event.target?.closest?.('wa-input, wa-button, button')) {
                                                        event.currentTarget.focus({preventScroll: true})
                                                    }
                                                    selectCorrectionPoint(
                                                        event,
                                                        displayedCorrection.trackSlug,
                                                        displayedCorrection.id,
                                                        point.id,
                                                    )
                                                }}
                                                onKeyDown={event => handleCorrectionPointRowKeyDown(
                                                    event,
                                                    displayedCorrection.trackSlug,
                                                    displayedCorrection.id,
                                                    point.id,
                                                )}
                                            >
                                                <WaInput
                                                    className="lgs-widget-no-drag"
                                                    appearance="filled"
                                                    size="s"
                                                    type="text"
                                                    aria-label="Lat"
                                                    disabled={removed}
                                                    readOnly
                                                    value={Number.isFinite(latitude) ? latitude.toFixed(6) : ''}
                                                />
                                                <WaInput
                                                    className="lgs-widget-no-drag"
                                                    appearance="filled"
                                                    size="s"
                                                    type="text"
                                                    aria-label="Lon"
                                                    disabled={removed}
                                                    readOnly
                                                    value={Number.isFinite(longitude) ? longitude.toFixed(6) : ''}
                                                />
                                                <WaInput
                                                    className="lgs-widget-no-drag"
                                                    appearance="filled"
                                                    size="s"
                                                    type="text"
                                                    aria-label="Height"
                                                    disabled={removed}
                                                    inputMode="numeric"
                                                    value={Number.isFinite(height) ? String(Math.round(height)) : '0'}
                                                    onChange={event => updateControlCoordinatePart(displayedCorrection.trackSlug, displayedCorrection.id, point.id, 2, event.target.value)}
                                                />
                                                <div className="fix-path-correction-point-actions lgs-widget-no-drag">
                                                    <WaTooltip for={resetButtonId} placement="top">{removed ? 'Restore' : 'Reset'}</WaTooltip>
                                                    <WaButton
                                                        className="lgs-widget-no-drag"
                                                        id={resetButtonId}
                                                        size="s"
                                                        appearance="plain"
                                                        variant="neutral"
                                                        aria-label={removed ? 'Restore correction point' : 'Reset correction point'}
                                                        onClick={event => {
                                                            event.stopPropagation()
                                                            resetControlPoint(displayedCorrection.trackSlug, displayedCorrection.id, point.id)
                                                        }}
                                                    >
                                                        <WaIcon name="arrow-rotate-left" variant="regular"/>
                                                    </WaButton>
                                                    <WaTooltip for={removeButtonId} placement="top">{'Remove'}</WaTooltip>
                                                    <WaButton
                                                        className="lgs-widget-no-drag"
                                                        id={removeButtonId}
                                                        size="s"
                                                        appearance="plain"
                                                        variant="danger"
                                                        aria-label="Remove correction point"
                                                        disabled={removed}
                                                        onClick={event => {
                                                            event.stopPropagation()
                                                            removeControlPoint(displayedCorrection.trackSlug, displayedCorrection.id, point.id)
                                                        }}
                                                    >
                                                        <WaIcon name="trash" variant="regular"/>
                                                    </WaButton>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </LGSScrollbars>
                        </div>
                    </section>
                )}
            </div>
        </div>

        <footer className="fix-path-panel-footer">
            <div className="fix-path-panel-footer-actions">
                <WaButton className="lgs-widget-no-drag" size="s" appearance="outlined" variant="neutral" onClick={close} disabled={saving}>
                    {'Cancel'}
                </WaButton>
                <WaButton className="lgs-widget-no-drag" size="s" appearance="filled" variant="brand" loading={saving} onClick={validate}>
                    <WaIcon slot="start" name="check" variant="regular"/>{'Validate'}
                </WaButton>
            </div>
        </footer>
    </aside>
)
