/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Tunnel.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-06-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/
/**
 * Tunnel.jsx
 *
 * Displays a horizontal tunnel of steps with FontAwesome icons
 * Each step has optional beforeStep and afterStep events, mandatory status, and content
 *
 * @module Tunnel
 */
import { LGSPopup }         from '@Components/LGSPopup'
import { WaButton, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                                                  from 'classnames'
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import './style.css'

const normalizeTooltip = (tooltip) => {
    if (tooltip === false || tooltip === null || tooltip === undefined || tooltip === '') {
        return null
    }

    if (typeof tooltip === 'string') {
        return {title: tooltip}
    }

    return tooltip
}

const TunnelTooltipContent = memo(({tooltip, icon}) => {
    const content = normalizeTooltip(tooltip)

    if (!content) {
        return null
    }

    if (content.content) {
        return content.content
    }

    const titleIcon = content.icon ?? icon
    const titleIconVariant = content.iconVariant ?? 'regular'

    return (
        <>
            {content.title && (
                <span className="lgs-tunnel-tooltip-heading">
                    {titleIcon && <WaIcon name={titleIcon} variant={titleIconVariant}/>}
                    <span className="lgs-tunnel-tooltip-title">{content.title}</span>
                </span>
            )}
            {content.text && <span className="lgs-tunnel-tooltip-text">{content.text}</span>}
        </>
    )
})

TunnelTooltipContent.displayName = 'TunnelTooltipContent'

export const TunnelTooltip = memo(({anchorId, tooltip, icon, placement = 'top', children}) => {
    const [active, setActive] = useState(false)
    const content = normalizeTooltip(tooltip)

    const show = useCallback(() => setActive(true), [])
    const hide = useCallback(() => setActive(false), [])

    if (!content) {
        return children
    }

    return (
        <>
            <span
                id={anchorId}
                className="lgs-tunnel-tooltip-anchor"
                onFocusCapture={show}
                onBlurCapture={hide}
                onPointerEnter={show}
                onPointerLeave={hide}
                onPointerDown={hide}
            >
                {children}
            </span>
            <LGSPopup
                className="lgs-tunnel-tooltip-popup"
                anchor={anchorId}
                active={active}
                onRequestClose={hide}
                placement={placement}
                distance={8}
                arrow
                arrowPadding={8}
                flip
                shift
                flipPadding={8}
                shiftPadding={8}
                strategy="fixed"
            >
                <div className="lgs-tunnel-tooltip lgs-card wa-theme-lgs1920-on-map" role="tooltip">
                    <TunnelTooltipContent tooltip={content} icon={icon}/>
                </div>
            </LGSPopup>
        </>
    )
})

TunnelTooltip.displayName = 'TunnelTooltip'

/**
 * @typedef {Object} TunnelStep
 * @property {string} icon - FontAwesome icon name (e.g., 'user', 'check')
 * @property {string} text - Step label
 * @property {boolean} [done=false] - Whether the step is completed
 * @property {boolean} [mandatory=false] - Whether the step is mandatory
 * @property {React.ReactNode} [component] - Content to render for the step
 * @property {string|Object|false} [tooltip] - Optional tooltip content. Uses text when omitted, false disables it
 * @property {string} [tooltipPlacement='top'] - Preferred tooltip placement. It flips vertically when needed
 * @property {string} [variant='neutral'] - Web Awesome button variant
 * @property {string} [appearance='plain'] - Web Awesome button appearance
 * @property {string} [hoverVariant] - Web Awesome button variant while hovered
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
 * @param {number} [props.defaultStepIndex=0] - Index of the step to display by default
 * @param {() => void} props.onCancel - Callback for exit button
 * @param {string} [props.className] - Additional CSS class names
 * @returns {JSX.Element} The rendered tunnel component
 */
export const Tunnel = memo(({
                                steps,
                                defaultStepIndex = 0,
                                onCancel,
                                className = '',
                                cancelTooltip = 'Exit',
                                cancelAppearance = 'plain',
                                leadingAction = null,
                            }) => {
    // State for the current step index
    const [currentContainer, setCurrentStepIndex] = useState(defaultStepIndex)
    const [hoveredStep, setHoveredStep] = useState(null)
    const tunnelId = useId().replace(/:/g, '')
    // Ref for the tunnel container
    const _tunnelContainer = useRef(null)

    /**
     * Validates if the default step is not blocked by mandatory steps
     */
    const validateDefaultStep = useCallback(() => {
        const isBlocked = steps
            .slice(0, defaultStepIndex)
            .some(step => step.mandatory && !step.done)
        if (isBlocked) {
            console.warn(`The default step ${defaultStepIndex} is blocked by mandatory steps.`)
            return false
        }
        return true
    }, [steps, defaultStepIndex])

    /**
     * Handles step navigation with optional per-step before/after events
     * Prevents navigation if mandatory steps are incomplete or beforeStep returns false
     * Triggers afterStep of the previous step and beforeStep of the target step
     *
     * @param {number} index - Target step index
     * @param {PointerEvent} event - Pointer event
     */
    const handleStepClick = useCallback((index, event) => {
        const targetStep = steps[index]

        // Clicking the current step should still trigger its action, if any.
        if (index === currentContainer) {
            targetStep?.onClick?.(index, event)
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

    // Execute beforeStep for the default step on initial render
    useEffect(() => {
        if (_tunnelContainer.current) {
            _tunnelContainer.current.style.opacity = '1'
        }
        if (validateDefaultStep()) {
            const defaultStep = steps[defaultStepIndex]
            if (defaultStep?.beforeStep) {
                defaultStep.beforeStep(defaultStepIndex)
            }
        }
    }, [steps, defaultStepIndex, validateDefaultStep])

    // Memoize step items to prevent unnecessary re-renders
    const stepItems = useMemo(() =>
                                  steps.map((step, index) => {
                                      const isBlocked = steps
                                          .slice(0, index)
                                          .some(s => s.mandatory && !s.done)
                                      return (
                                          <div
                                              key={index}
                                              className="lgs-tunnel-bar-item"
                                              style={{
                                                  opacity: step.className ? 1 : 0.7,
                                              }}
                                          >
                                              <TunnelTooltip
                                                  anchorId={`lgs-tunnel-${tunnelId}-step-${index}`}
                                                  tooltip={step.tooltip ?? step.text}
                                                  icon={step.tooltipIcon ?? step.icon}
                                                  placement={step.tooltipPlacement ?? 'top'}
                                              >
                                                  <WaButton
                                                    variant={hoveredStep === index ? (step.hoverVariant ?? step.variant ?? 'neutral') : (step.variant ?? 'neutral')}
                                                    appearance={step.appearance ?? 'plain'}
                                                    aria-label={step.text}
                                                    aria-disabled={isBlocked}
                                                    className={classNames({
                                                        'lgs-tunnel-button-disabled': isBlocked,
                                                    }, step.className)}
                                                    onPointerEnter={() => setHoveredStep(index)}
                                                    onPointerLeave={() => setHoveredStep(current => current === index ? null : current)}
                                                    onClick={event => handleStepClick(index, event)}
                                                >
                                                      <WaIcon name={step.icon} variant="regular"/>
                                                  </WaButton>
                                              </TunnelTooltip>
                                          </div>
                                      )
                                  }),
                              [steps, handleStepClick, tunnelId])

    return (
        <div className={classNames('lgs-tunnel-container', className)} ref={_tunnelContainer}>
            {/* Tunnel navigation bar */}
            <div className="lgs-tunnel-bar">
                {leadingAction}
                {stepItems}
                {/* Exit button */}
                <TunnelTooltip
                    anchorId={`lgs-tunnel-${tunnelId}-cancel`}
                    tooltip={cancelTooltip}
                    icon="xmark"
                >
                    <WaButton
                        variant="neutral"
                        appearance={cancelAppearance}
                        className="lgs-tunnel-cancel"
                        aria-label="Exit"
                        onPointerDown={onCancel}>
                        <WaIcon name="xmark" variant="regular"/>
                    </WaButton>
                </TunnelTooltip>

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
