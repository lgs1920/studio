/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Tunnel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-20
 * Last modified: 2025-10-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Tunnel.jsx
 *
 * Displays a horizontal tunnel of steps with FontAwesome icons
 * Each step has optional beforeStep and afterStep events, mandatory status, and content
 *
 * @module Tunnel
 */

import { faXmark }                                                 from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton, SlTooltip }                                 from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                   from '@Utils/FA2SL'
import classNames                                                  from 'classnames'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './style.css'

/**
 * @typedef {Object} TunnelStep
 * @property {string} icon - FontAwesome icon name (e.g., 'user', 'check')
 * @property {string} text - Step label
 * @property {boolean} [done=false] - Whether the step is completed
 * @property {boolean} [mandatory=false] - Whether the step is mandatory
 * @property {React.ReactNode} [component] - Content to render for the step
 * @property {(index: number, event?: PointerEvent) => boolean} [beforeStep] - Called before navigating to this step,
 *     return false to cancel
 * @property {(index: number) => void} [afterStep] - Called after navigating to this step
 * @property {(index: number, event: PointerEvent) => boolean} [onClick] - Optional click handler, return false to
 *     cancel
 */

/**
 * Tunnel component displays a horizontal tunnel of steps
 * Each step has a FontAwesome icon, label, optional content, and optional navigation events
 * Mandatory steps must be completed before proceeding
 *
 * @component
 * @param {Object} props - Component props
 * @param {TunnelStep[]} props.steps - Array of steps
 * @param {() => void} props.onCancel - Callback for exit button
 * @param {string} [props.className] - Additional CSS class names
 * @returns {JSX.Element} The rendered tunnel component
 */
export const Tunnel = memo(({steps, onCancel, className = ''}) => {
    // State for the current step index
    const [currentContainer, setCurrentStepIndex] = useState(0)
    // Ref for the tunnel container
    const _tunnelContainer = useRef(null)

    /**
     * Handles step navigation with optional per-step before/after events
     * Prevents navigation if mandatory steps are incomplete or beforeStep returns false
     * Triggers afterStep of the previous step and beforeStep of the target step
     *
     * @param {number} index - Target step index
     * @param {PointerEvent} event - Pointer event
     */
    const handleStepClick = useCallback((index, event) => {
        // Early return if clicking the current step
        if (index === currentContainer) {
            return
        }

        // Check if navigation is blocked by mandatory steps
        const isBlocked = steps
            .slice(0, index)
            .some(step => step.mandatory && !step.done)

        if (isBlocked) {
            return
        }

        // Trigger afterStep for the current step if it exists
        if (steps[currentContainer]?.afterStep) {
            steps[currentContainer].afterStep(currentContainer)
        }

        // Trigger onClick for the target step if defined
        const targetStep = steps[index]
        if (targetStep.onClick?.(index, event) === false) {
            return
        }

        // Trigger beforeStep for the target step if defined
        if (targetStep.beforeStep?.(index, event) === false) {
            return
        }

        // Update the current step index
        setCurrentStepIndex(index)
    }, [steps, currentContainer])

    // Execute beforeStep for the first step on initial render
    useEffect(() => {
        // Set initial opacity to ensure visibility
        if (_tunnelContainer.current) {
            _tunnelContainer.current.style.opacity = '1'
        }
        // Trigger beforeStep for the first step if defined
        if (steps[0]?.beforeStep) {
            steps[0].beforeStep(0)
        }
    }, [steps])

    // Memoize step items to prevent unnecessary re-renders
    const stepItems = useMemo(() => steps.map((step, index) => {
        const isDone = step.done || false
        const isCurrent = index === currentContainer
        const isBlocked = steps
            .slice(0, index)
            .some(s => s.mandatory && !s.done)

        return (
            <div key={index} className="lgs-tunnel-bar-item" style={{
                opacity:       isCurrent || step.className ? 1 : 0.7,
                pointerEvents: isBlocked ? 'none' : 'auto',
            }}>
                <SlTooltip content={step.text} placement="top">
                    <SlIconButton
                        className={classNames('lgs-tunnel-element', step.className, {
                            'lgs-tunnel-element-done':    isDone,
                            'lgs-tunnel-element-active':  isCurrent,
                            'lgs-tunnel-element-blocked': isBlocked,
                        })}
                        onPointerDown={event => handleStepClick(index, event)}
                        disabled={isBlocked}
                        library="fa"
                        name={FA2SL.set(step.icon)}
                    />
                </SlTooltip>
                <div className="lgs-tunnel-bar-spacer"/>
            </div>
        )
    }), [steps, currentContainer, handleStepClick])

    return (
        <div className={classNames('lgs-tunnel-container', className)} ref={_tunnelContainer}>
            {/* Tunnel navigation bar */}
            <div className="lgs-tunnel-bar">
                <div className="lgs-tunnel-bar-spacer"/>
                {stepItems}
                {/* Exit button */}
                <SlTooltip content="Cancel" placement="top">
                    <SlIconButton
                        className="lgs-tunnel-cancel lgs-tunnel-element"
                        onPointerDown={onCancel}
                        library="fa"
                        name={FA2SL.set(faXmark)}
                    />
                </SlTooltip>
                <div className="lgs-tunnel-bar-spacer"/>
            </div>

            {/* Current step content */}
            {steps[currentContainer]?.component && (
                <div className="lgs-tunnel-content">
                    {steps[currentContainer].component}
                </div>
            )}
        </div>
    )
})