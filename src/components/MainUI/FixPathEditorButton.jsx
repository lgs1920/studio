/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FixPathEditorButton.jsx
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

import { WaButton, WaIcon, WaTooltip } from '@awesome.me/webawesome/dist/react'
import { useCallback } from 'react'
import { useSnapshot } from 'valtio'

/**
 * Render the shared Fix Path editor entry point for a Journey.
 *
 * @param {Object} props - Button presentation and Journey state.
 * @param {string} [props.id='fix-path-editor-button'] - Unique button ID used by its tooltip.
 * @param {string} [props.className] - Optional button class names.
 * @param {Object|null} [props.journey=null] - Journey whose path can be edited.
 * @param {boolean} [props.hideWhenUnavailable] - Hide the entry point when no Journey is available.
 * @param {string} [props.tooltipPlacement] - Optional Web Awesome tooltip placement.
 * @param {string} [props.size] - Web Awesome button size.
 * @param {string} [props.appearance] - Web Awesome button appearance.
 * @param {boolean} [props.showLabel] - Whether to display the Fix Path label.
 * @returns {Object|null} The Fix Path button or no element when hidden.
 */
export const FixPathEditorButton = ({
    id = 'fix-path-editor-button',
    className = '',
    journey = null,
    hideWhenUnavailable = false,
    tooltipPlacement,
    size = 's',
    appearance = 'outlined',
    showLabel = true,
}) => {
    const editor = useSnapshot(lgs.stores.journeyEditor)
    const isOpen = editor.fixPathEditorOpen === true

    /** Toggle Fix Path for the supplied Journey. */
    const toggleFixPathEditor = useCallback(() => {
        if (journey) {
            lgs.stores.journeyEditor.fixPathEditorOpen = lgs.stores.journeyEditor.fixPathEditorOpen !== true
        }
    }, [journey])

    if (!journey && hideWhenUnavailable) {
        return null
    }

    const buttonClassName = [className, isOpen && 'is-selected'].filter(Boolean).join(' ')
    const button = (
        <WaButton
            className={buttonClassName}
            id={id}
            size={size}
            appearance={appearance}
            variant="brand"
            disabled={!journey}
            aria-label="Fix Path"
            aria-pressed={isOpen}
            onClick={toggleFixPathEditor}
        >
            <WaIcon name="draw-polygon" variant="regular" size={showLabel ? 's' : undefined}/>
            {showLabel && 'Fix Path'}
        </WaButton>
    )

    return tooltipPlacement
        ? (
            <>
                <WaTooltip for={id} placement={tooltipPlacement}>Fix Path</WaTooltip>
                {button}
            </>
        )
        : button
}
