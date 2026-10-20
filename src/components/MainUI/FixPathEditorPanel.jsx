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
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {useLayoutEffect, useRef} from 'react'
import {LGSScrollbars} from '@Components/MainUI/LGSScrollbars'
import {applyPOIDuotoneIconStyles} from '@Components/MainUI/MapPOI/duotoneIconUtils'
import {ToggleStateIcon} from '@Components/ToggleStateIcon'
import {UnitUtils} from '@Utils/UnitUtils'
import {WaButton, WaIcon, WaInput, WaNumberInput, WaTooltip} from '@awesome.me/webawesome/dist/react'
import {getControlPointCoordinate} from './FixPathEditorGeometry'

/** Render Fix Path controls and the active section's editable point list. */
export const FixPathEditorPanel = ({
    activeCorrectionIndex,
    activateSectionAt,
    areaMode,
    canRedo,
    canUndo,
    close,
    focusJourney,
    currentCorrectionVisible,
    displayedCorrection,
    displayedCorrectionPreview,
    displayedTrack,
    eraseSelectedControlPoints,
    handleCorrectionPointListKeyDown,
    handleCorrectionPointRowKeyDown,
    handleFixPathShortcut,
    helpOpen,
    heightUnit,
    orderedCorrections,
    eraseMode,
    onCorrectionVisibilityChange,
    projected,
    persistCurrentDraftCorrections,
    removeControlPoint,
    resetControlPoint,
    saving,
    scanProgress,
    selectCorrectionPoint,
    selectedControlPoints,
    selection,
    setHelpOpen,
    setEraseMode,
    setSelection,
    undoCorrectionEdit,
    redoCorrectionEdit,
    widgetResized,
    updateControlCoordinatePart,
}) => {
    const _correctionPointsList = useRef(null)

    useLayoutEffect(() => {
        const selectedPoint = [...selectedControlPoints].reverse().find(point => (
            point.trackSlug === displayedCorrection?.trackSlug
            && point.correctionId === displayedCorrection?.id
        ))
        if (!selectedPoint) {
            return
        }

        const rows = _correctionPointsList.current?.querySelectorAll('.fix-path-correction-point-row') ?? []
        const selectedRow = Array.from(rows).find(row => (
            row.dataset.trackSlug === selectedPoint.trackSlug
            && row.dataset.correctionId === selectedPoint.correctionId
            && row.dataset.controlPointId === selectedPoint.controlPointId
        ))
        selectedRow?.scrollIntoView?.({block: 'nearest', inline: 'nearest', behavior: 'smooth'})
    }, [displayedCorrection?.id, displayedCorrection?.trackSlug, selectedControlPoints])

    return (
    <aside
        className={'fix-path-panel lgs-card wa-theme-lgs1920-on-map' + (widgetResized ? ' is-resized' : '')}
        aria-label="Fix Path editor"
        onKeyDownCapture={handleFixPathShortcut}
    >
        <header className="fix-path-panel-header">
            <h2><WaIcon name="draw-polygon" variant="regular" aria-hidden="true"/>{'Fix Path'}</h2>
            <p className="fix-path-correction-selection-hint">
                <span className="fix-path-correction-selection-bracket">{'['}</span>
                <kbd className="lgs--shortcut-key">{'Shift'}</kbd>
                <span>{' + Click/drag to add points'}</span>
                <span className="fix-path-correction-selection-bracket">{']'}</span>
            </p>
            <div className="fix-path-panel-header-actions" aria-label="Actions">
                <WaTooltip for="fix-path-focus-journey" placement="top">{'Focus Journey'}</WaTooltip>
                <WaButton
                    id="fix-path-focus-journey"
                    className="lgs-widget-no-drag"
                    size="s"
                    appearance="plain"
                    variant="neutral"
                    aria-label="Focus Journey"
                    disabled={saving}
                    onClick={focusJourney}
                >
                    <WaIcon name="crosshairs-simple" variant="regular" aria-hidden="true"/>
                </WaButton>
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
                    disabled={saving}
                    onClick={() => setHelpOpen(isOpen => !isOpen)}
                >
                    <WaIcon name="question" variant="regular" aria-hidden="true"/>
                </WaButton>
                <WaButton className="lgs-widget-no-drag" size="s" appearance="plain" variant="neutral" aria-label="Close Fix Path editor" disabled={saving} onClick={close}>
                    <WaIcon name="xmark" variant="regular"/>
                </WaButton>
            </div>
        </header>

        <nav className="fix-path-main-toolbar lgs-widget-no-drag" aria-label="Fix Path tools">
            <div className="fix-path-toolbar-group fix-path-toolbar-history">
                <WaTooltip for="fix-path-undo" placement="top">{'Undo'}</WaTooltip>
                <WaButton
                    id="fix-path-undo"
                    size="s"
                    appearance="plain"
                    variant="neutral"
                    aria-label="Undo correction change"
                    disabled={saving || !canUndo}
                    onClick={undoCorrectionEdit}
                >
                    <WaIcon name="arrow-rotate-left" variant="regular" aria-hidden="true"/>
                </WaButton>
                <WaTooltip for="fix-path-redo" placement="top">{'Redo'}</WaTooltip>
                <WaButton
                    id="fix-path-redo"
                    size="s"
                    appearance="plain"
                    variant="neutral"
                    aria-label="Redo correction change"
                    disabled={saving || !canRedo}
                    onClick={redoCorrectionEdit}
                >
                    <WaIcon name="arrow-rotate-right" variant="regular" aria-hidden="true"/>
                </WaButton>
            </div>

            <div className="fix-path-toolbar-group fix-path-toolbar-navigation" aria-label="Section navigation">
                {orderedCorrections.length > 2 && (
                    <>
                        <WaTooltip for="fix-path-first-section" placement="top">{'First section'}</WaTooltip>
                        <WaButton
                            id="fix-path-first-section"
                            size="s"
                            appearance="plain"
                            variant="neutral"
                            aria-label="First section"
                            disabled={saving || activeCorrectionIndex === 0}
                            onClick={() => activateSectionAt(0)}
                        >
                            <WaIcon name="arrow-left-to-line" variant="regular" aria-hidden="true"/>
                        </WaButton>
                    </>
                )}
                {orderedCorrections.length > 1 && (
                    <>
                        <WaTooltip for="fix-path-previous-section" placement="top">{'Previous section'}</WaTooltip>
                        <WaButton
                            id="fix-path-previous-section"
                            size="s"
                            appearance="plain"
                            variant="neutral"
                            aria-label="Previous section"
                            disabled={saving}
                            onClick={() => activateSectionAt(activeCorrectionIndex - 1)}
                        >
                            <WaIcon name="chevron-left" variant="regular" aria-hidden="true"/>
                        </WaButton>
                    </>
                )}
                <span className="fix-path-section-position" aria-live="polite">
                    {displayedCorrection ? (activeCorrectionIndex + 1) + ' / ' + orderedCorrections.length : '0 / 0'}
                </span>
                {orderedCorrections.length > 1 && (
                    <>
                        <WaTooltip for="fix-path-next-section" placement="top">{'Next section'}</WaTooltip>
                        <WaButton
                            id="fix-path-next-section"
                            size="s"
                            appearance="plain"
                            variant="neutral"
                            aria-label="Next section"
                            disabled={saving}
                            onClick={() => activateSectionAt(activeCorrectionIndex + 1)}
                        >
                            <WaIcon name="chevron-right" variant="regular" aria-hidden="true"/>
                        </WaButton>
                    </>
                )}
                {orderedCorrections.length > 2 && (
                    <>
                        <WaTooltip for="fix-path-last-section" placement="top">{'Last section'}</WaTooltip>
                        <WaButton
                            id="fix-path-last-section"
                            size="s"
                            appearance="plain"
                            variant="neutral"
                            aria-label="Last section"
                            disabled={saving || activeCorrectionIndex === orderedCorrections.length - 1}
                            onClick={() => activateSectionAt(orderedCorrections.length - 1)}
                        >
                            <WaIcon name="arrow-right-to-line" variant="regular" aria-hidden="true"/>
                        </WaButton>
                    </>
                )}
            </div>

            <div className="fix-path-toolbar-group fix-path-toolbar-edit-actions">
                <WaTooltip for="fix-path-correction-visibility" placement="top">
                    {currentCorrectionVisible ? 'Hide corrections' : 'Show corrections'}
                </WaTooltip>
                <ToggleStateIcon
                    id="fix-path-correction-visibility"
                    className="fix-path-correction-visibility lgs-widget-no-drag"
                    size="s"
                    appearance="plain"
                    buttonVariant="neutral"
                    iconVariant="regular"
                    initial={currentCorrectionVisible}
                    aria-label={currentCorrectionVisible ? 'Hide corrections' : 'Show corrections'}
                    aria-pressed={currentCorrectionVisible}
                    disabled={saving || !displayedCorrection}
                    onChange={onCorrectionVisibilityChange}
                />
                <WaTooltip for="fix-path-erase" placement="top">{'Erase selection'}</WaTooltip>
                <WaButton
                    id="fix-path-erase"
                    size="s"
                    appearance={eraseMode ? 'filled' : 'plain'}
                    variant={eraseMode ? 'brand' : 'neutral'}
                    aria-label="Erase selection"
                    aria-pressed={eraseMode}
                    disabled={saving || !displayedCorrection}
                    onClick={eraseSelectedControlPoints}
                >
                    <WaIcon name="eraser" variant="regular" aria-hidden="true"/>
                </WaButton>
            </div>
        </nav>

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

        {saving && <p className="fix-path-status" aria-live="polite">{'Validating and applying Journey changes…'}</p>}

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
                    disabled={saving}
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
                            <span>{'Height (' + heightUnit + ')'}</span>
                            <span/>
                        </div>
                        <div className="fix-path-correction-points-scroll-area">
                            <LGSScrollbars
                                autoHeight={!widgetResized}
                                autoHeightMax="min(var(--fix-path-correction-list-max-height), max(0px, calc(100vh - 13rem)))"
                            >
                                <div
                                    className="fix-path-correction-points-list"
                                    ref={_correctionPointsList}
                                    onKeyDownCapture={handleCorrectionPointListKeyDown}
                                >
                                    {displayedCorrection.controlPoints.filter(point => point.erased !== true).map(point => {
                                        const coordinate = getControlPointCoordinate(
                                            displayedTrack?.content,
                                            displayedCorrection,
                                            point,
                                            displayedCorrectionPreview,
                                        )
                                        const selected = selectedControlPoints.some(item => item.trackSlug === displayedCorrection.trackSlug
                                            && item.correctionId === displayedCorrection.id
                                            && item.controlPointId === point.id)
                                        const latitude = Number(coordinate[1])
                                        const longitude = Number(coordinate[0])
                                        const height = Number(coordinate[2])
                                        const removed = point.removed === true
                                        const moved = point.fixed === true && !removed
                                        const unmodified = point.fixed === false && !removed
                                        const showStatus = removed || selected || moved || unmodified
                                        const statusClass = removed
                                            ? 'is-removed'
                                            : (moved ? 'is-moved' : 'is-unmodified') + (selected ? ' is-selected' : '')
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
                                                tabIndex={removed ? -1 : 0}
                                                data-track-slug={displayedCorrection.trackSlug}
                                                data-correction-id={displayedCorrection.id}
                                                data-control-point-id={point.id}
                                                aria-disabled={removed ? 'true' : undefined}
                                                aria-label={removed ? 'Removed correction point' : 'Correction point'}
                                                    aria-current={selected ? 'true' : undefined}
                                                aria-keyshortcuts="ArrowUp ArrowDown PageUp PageDown Backspace Delete Control+R Meta+R"
                                                onClick={event => {
                                                    if (removed) return
                                                    if (!event.target?.closest?.('wa-input, wa-number-input, wa-button, button')) {
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
                                                {showStatus && (
                                                    <WaIcon
                                                        className={'fix-path-correction-point-status-indicator ' + statusClass}
                                                        name={unmodified ? 'diamond' : 'circle'}
                                                        variant="regular"
                                                        family="duotone"
                                                        onWaLoad={applyPOIDuotoneIconStyles}
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                <WaInput
                                                    className="lgs-widget-no-drag fix-path-correction-point-coordinate"
                                                    appearance="filled"
                                                    size="s"
                                                    type="text"
                                                    aria-label="Lat"
                                                    disabled={removed}
                                                    readOnly
                                                    value={Number.isFinite(latitude) ? latitude.toFixed(6) : ''}
                                                />
                                                <WaInput
                                                    className="lgs-widget-no-drag fix-path-correction-point-coordinate"
                                                    appearance="filled"
                                                    size="s"
                                                    type="text"
                                                    aria-label="Lon"
                                                    disabled={removed}
                                                    readOnly
                                                    value={Number.isFinite(longitude) ? longitude.toFixed(6) : ''}
                                                />
                                                <WaNumberInput
                                                    className="lgs-widget-no-drag fix-path-correction-point-coordinate fix-path-correction-point-altitude"
                                                    appearance="filled"
                                                    size="s"
                                                    aria-label={'Height (' + heightUnit + ')'}
                                                    disabled={removed || saving}
                                                    withoutSteppers
                                                    step={1}
                                                    value={Number.isFinite(height) ? Math.round(UnitUtils.convert(height).to(heightUnit)) : 0}
                                                    onInput={event => updateControlCoordinatePart(displayedCorrection.trackSlug, displayedCorrection.id, point.id, 2, event.target.value)}
                                                    onChange={persistCurrentDraftCorrections}
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
                                                        disabled={saving || (!removed && point.fixed !== true)}
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
                                                        disabled={saving || removed}
                                                        onClick={event => {
                                                            event.stopPropagation()
                                                            removeControlPoint(displayedCorrection.trackSlug, displayedCorrection.id, point.id)
                                                        }}
                                                    >
                                                        <WaIcon
                                                            className={removed ? 'fix-path-correction-point-deleted-indicator' : ''}
                                                            name="trash"
                                                            variant="regular"
                                                            aria-hidden="true"
                                                        />
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

    </aside>
    )
}
