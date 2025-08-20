/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ManageTunnel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-20
 * Last modified: 2025-08-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * ManageTunnel.jsx
 *
 * Displays a horizontal tunnel of steps with FontAwesome icons
 * Each step has optional beforeStep and afterStep events, mandatory status, and content
 *
 */

import { SlButton, SlIcon, SlIconButton, SlTooltip }          from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                              from '@Utils/FA2SL'
import classNames                                             from 'classnames'
import { useState, useCallback, useRef, useEffect, Fragment } from 'react'
import { faXmark }                                            from '@fortawesome/pro-regular-svg-icons'
import './style.css'

/**
 * @typedef {Object} TunnelStep
 * @property {string} icon - FontAwesome icon name (e.g., 'user', 'check')
 * @property {string} text - Step label
 * @property {boolean} [done=false] - Whether the step is completed
 * @property {boolean} [mandatory=false] - Whether the step is mandatory
 * @property {React.ReactNode} [component] - Content to render for the step
 * @property {(index: number) => boolean} [beforeStep] - Called before navigating to this step, return false to cancel
 * @property {(index: number) => void} [afterStep] - Called after navigating to this step
 */

/**
 * ManageTunnel component displays a horizontal tunnel of steps
 * Each step has a FontAwesome icon, label, optional content, and optional navigation events
 * Mandatory steps must be completed before proceeding
 *
 * @param {Object} props
 * @param {TunnelStep[]} props.steps - Array of steps
 * @param {() => void} props.onExit - Callback for exit button
 * @returns {JSX.Element}
 */
export const ManageTunnel = ({steps, onCancel, className}) => {
    // State for the current step index
    const [currentContainer, setCurrentStepIndex] = useState(0)
    const _tunnelContainer = useRef(null)

    /**
     * Handles step navigation with optional per-step before/after events
     * Prevents navigation if mandatory steps are incomplete or beforeStep returns false
     * Triggers afterStep of the previous step and beforeStep of the target step
     *
     * @param {number} index - Target step index
     */
    const handleStepClick = useCallback(
        index => {
            // Check if navigation is blocked by mandatory steps
            const isBlocked = steps
                .slice(0, index)
                .some(step => step.mandatory && !step.done)

            if (isBlocked) {
                return
            }

            // Trigger afterStep event for the previous step if it exists
            if (currentContainer !== index && steps[currentContainer]?.afterStep) {
                steps[currentContainer].afterStep(currentContainer)
            }

            // Trigger beforeStep event for the target step if defined
            const targetStep = steps[index]
            if (targetStep.beforeStep?.(index) === false) {
                return
            }

            // Update the current step index
            setCurrentStepIndex(index)
        },
        [steps, currentContainer],
    )

    // Execute beforeStep for the first step on initial render
    useEffect(() => {
        _tunnelContainer.current.style.opacity = 1
        if (steps[0]?.beforeStep) {
            steps[0].beforeStep(0)
        }
    }, [steps])

    return (
        <div className={classNames('lgs-tunnel-container', ...[className])} ref={_tunnelContainer}>
            {/* Tunnel navigation bar */}
            <div className="lgs-tunnel-bar">
                <div className="lgs-tunnel-bar-spacer"/>
                {steps.map((step, index) => {
                    const isDone = step.done || false
                    const isCurrent = index === currentContainer
                    const isBlocked = steps
                        .slice(0, index)
                        .some(s => s.mandatory && !s.done)

                    return (
                        <div key={index}>
                            <SlTooltip content={step.text} placement="top">
                                <SlIconButton
                                    className={`
                lgs-tunnel-element
                ${isDone ? 'lgs-tunnel-element-done' : ''}
                ${isCurrent ? 'lgs-tunnel-element-active' : ''}
                ${isBlocked ? 'lgs-tunnel-element-blocked' : ''}
              `}
                                    onClick={() => handleStepClick(index)}
                                    disabled={isBlocked}
                                    library="fa" name={FA2SL.set(step.icon)}
                                >
                                    <span className="lgs-tunnel-text">{}</span>
                                </SlIconButton>
                            </SlTooltip>
                            <div className="lgs-tunnel-bar-spacer"/>
                        </div>
                    )
                })}
                {/* Exit button */}
                <SlTooltip content={'Cancel'} placement="top">
                    <SlIconButton className="lgs-tunnel-cancel lgs-tunnel-element"
                                  onClick={onCancel}
                                  library="fa" name={FA2SL.set(faXmark)}/>
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
}