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

import {useLayoutEffect, useRef, useState} from 'react'
import {LGSScrollbars} from '@Components/MainUI/LGSScrollbars'
import {applyPOIDuotoneIconStyles} from '@Components/MainUI/MapPOI/duotoneIconUtils'
import {ToggleStateIcon} from '@Components/ToggleStateIcon'
import {UnitUtils} from '@Utils/UnitUtils'
import {WaButton, WaCallout, WaIcon, WaInput, WaNumberInput, WaTooltip} from '@awesome.me/webawesome/dist/react'
import {getControlPointCoordinate} from './FixPathEditorGeometry'

const FIX_PATH_CALLOUT_PRESENTATION = {
    info: {variant: 'neutral', icon: 'circle-info', role: 'status', ariaLive: 'polite'},
    progress: {variant: 'neutral', icon: 'arrows-rotate', role: 'status', ariaLive: 'polite'},
    warning: {variant: 'warning', icon: 'triangle-exclamation', role: 'status', ariaLive: 'polite'},
    error: {variant: 'danger', icon: 'circle-exclamation', role: 'alert', ariaLive: 'assertive'},
}

/** Render consistent small callouts for Fix Path feedback and progress messages. */
export const FixPathCallout = ({
    type = 'info',
    icon,
    appearance = 'outlined',
    className,
    closable = false,
    dismissLabel = 'Dismiss message',
    children,
}) => {
    const [closed, setClosed] = useState(false)
    const presentation = FIX_PATH_CALLOUT_PRESENTATION[type] ?? FIX_PATH_CALLOUT_PRESENTATION.info

    if (closed) {
        return null
    }

    return (
        <WaCallout
            className={className}
            size="s"
            variant={presentation.variant}
            appearance={appearance}
            open
            role={presentation.role}
            aria-live={presentation.ariaLive}
        >
            <WaIcon slot="icon" name={icon ?? presentation.icon} variant="regular" aria-hidden="true"/>
            <div className={'fix-path-callout-message' + (closable ? ' is-closable' : '')}>
                <span>{children}</span>
                {closable && (
                    <WaButton
                        className="fix-path-callout-close lgs-widget-no-drag"
                        size="s"
                        appearance="plain"
                        variant="neutral"
                        aria-label={dismissLabel}
                        onClick={() => setClosed(true)}
                    >
                        <WaIcon name="xmark" variant="regular" aria-hidden="true"/>
                    </WaButton>
                )}
            </div>
        </WaCallout>
    )
}

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
    feedback,
    eraseSelectedControlPoints,
    handleCorrectionPointListKeyDown,
    handleCorrectionPointRowKeyDown,
    handleFixPathShortcut,
    helpOpen,
    heightUnit,
    orderedCorrections,
    eraseMode,
    onCorrectionVisibilityChange,
    persistCurrentDraftCorrections,
    removeControlPoint,
    resetControlPoint,
    saving,
    scanProgress,
    selectCorrectionPoint,
    selectedControlPoints,
    selection,
    setHelpOpen,
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

    const visibleFeedback = feedback
    const statusMessage = scanProgress
        ? {
            type: 'progress',
            icon: scanProgress.phase === 'project' ? 'magnifying-glass' : 'eye',
            text: scanProgress.phase === 'project'
                ? 'Scanning Journey points: ' + scanProgress.value + '%'
                : 'Checking terrain visibility: ' + scanProgress.value + '%',
        }
        : !areaMode
            ? selection.phase === 'choose-start'
                ? selectedControlPoints.length > 0
                    ? {
                        type: 'info',
                        icon: 'circle-check',
                        text: selectedControlPoints.length + (selectedControlPoints.length === 1
                            ? ' correction point selected.'
                            : ' correction points selected.'),
                    }
                    : {
                        type: 'info',
                        text: 'Shift or Alt draws a lasso; Ctrl+Shift or Ctrl+Alt draws a rectangle.',
                    }
                : {type: 'info', icon: 'draw-polygon', text: 'Adding points to correction.'}
            : null

    const canDismissSelectionInstruction = statusMessage?.text
        === 'Shift or Alt draws a lasso; Ctrl+Shift or Ctrl+Alt draws a rectangle.'

    return (
    <aside
        className={'fix-path-panel lgs-card wa-theme-lgs1920-on-map' + (widgetResized ? ' is-resized' : '')}
        aria-label="Fix Path editor"
        onKeyDownCapture={handleFixPathShortcut}
    >
        <header className="fix-path-panel-header">
            <h2><WaIcon name="draw-polygon" variant="regular" aria-hidden="true"/>{'Fix Path'}</h2>
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
                    {currentCorrectionVisible ? 'Hide section fixes' : 'Show section fixes'}
                </WaTooltip>
                <ToggleStateIcon
                    id="fix-path-correction-visibility"
                    className="fix-path-correction-visibility lgs-widget-no-drag"
                    size="s"
                    appearance="plain"
                    buttonVariant="neutral"
                    iconVariant="regular"
                    initial={currentCorrectionVisible}
                    aria-label={currentCorrectionVisible ? 'Hide section fixes' : 'Show section fixes'}
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

        {visibleFeedback && (
            <FixPathCallout
                className="fix-path-panel-callout fix-path-feedback"
                type={visibleFeedback.type}
                icon={visibleFeedback.type === 'warning' ? 'triangle-exclamation' : undefined}
            >
                <strong>{visibleFeedback.caption}</strong>{' '}{visibleFeedback.text}
            </FixPathCallout>
        )}

        {statusMessage && (
            <FixPathCallout
                key={statusMessage.text}
                className="fix-path-panel-callout fix-path-status-callout"
                type={statusMessage.type}
                icon={statusMessage.icon}
                closable={canDismissSelectionInstruction}
                dismissLabel="Dismiss selection instruction"
            >
                {statusMessage.text}
            </FixPathCallout>
        )}

        {saving && (
            <FixPathCallout className="fix-path-panel-callout fix-path-status-callout" type="progress">
                {'Validating and applying Journey changes…'}
            </FixPathCallout>
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
                    disabled={saving}
                    onClick={() => setSelection({phase: 'choose-start', startPoint: null, controlPoints: []})}
                >
                    {'Cancel section'}
                </WaButton>
            </div>
        )}

        <div className="fix-path-corrections-scroll-area">
            <div className="fix-path-corrections-list" aria-label="Correction points">
                {!displayedCorrection && (
                    <FixPathCallout className="fix-path-panel-callout fix-path-empty-state" type="info">
                        {'No correction points yet.'}
                    </FixPathCallout>
                )}
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
                                                            name="trash-can"
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
