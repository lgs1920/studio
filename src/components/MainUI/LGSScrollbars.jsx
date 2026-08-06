/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGSScrollbars.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { forwardRef, useRef } from 'react'
import { Scrollbars } from 'react-custom-scrollbars-2'

/**
 * Custom scrollbar wrapper for the LGS Studio.
 * Correctly forwards refs for SortableJS and hides native scrollbars.
 */
export const LGSScrollbars = forwardRef(
    ({
         children,
         autoHide = true,
         onScrollStateChange,
         onUpdate,
         thumbMinSize = 30,
         thumbSize,
         ...props
     }, ref) => {
        const containerRef = useRef(null)
        const lastScrollStateRef = useRef(null)

        const syncVerticalThumb = values => {
            const container = containerRef.current
            if (!container) {
                return
            }

            const trackVertical = container.querySelector('.track-vertical')
            const thumbVertical = container.querySelector('.thumb-vertical')

            if (!trackVertical || !thumbVertical) {
                return
            }

            const {
                      scrollTop    = 0,
                      scrollHeight = 0,
                      clientHeight = 0,
                  } = values ?? {}

            const hasVerticalOverflow = scrollHeight > clientHeight

            trackVertical.style.visibility = hasVerticalOverflow ? 'visible' : 'hidden'
            thumbVertical.style.display = hasVerticalOverflow ? 'block' : 'none'

            if (!hasVerticalOverflow) {
                thumbVertical.style.height = '0px'
                thumbVertical.style.transform = 'translateY(0px)'
                return
            }

            const trackHeight = trackVertical.clientHeight
            if (!trackHeight) {
                return
            }

            const computedThumbHeight = Math.ceil((clientHeight / scrollHeight) * trackHeight)
            const verticalThumbHeight = thumbSize ?? Math.max(computedThumbHeight, thumbMinSize)
            const maxOffset = Math.max(trackHeight - verticalThumbHeight, 0)
            const verticalThumbY = scrollHeight > clientHeight
                                   ? (scrollTop / (scrollHeight - clientHeight)) * maxOffset
                                   : 0

            thumbVertical.style.height = `${verticalThumbHeight}px`
            thumbVertical.style.transform = `translateY(${verticalThumbY}px)`
        }

        const handleUpdate = values => {
            syncVerticalThumb(values)
            const {
                      scrollTop = 0,
                      scrollHeight = 0,
                      clientHeight = 0,
                  } = values ?? {}
            const hasOverflow = scrollHeight > clientHeight
            const scrolled = hasOverflow && scrollTop > 0

            if (lastScrollStateRef.current !== scrolled) {
                lastScrollStateRef.current = scrolled
                onScrollStateChange?.(scrolled, values)
            }

            onUpdate?.(values)
        }

        return (
            <div
                ref={containerRef}
                className="lgs-scrollbars-container"
                style={{width: '100%', height: '100%', overflow: 'hidden'}}
            >
                <Scrollbars
                    className="lgs-scrollbars"
                    {...props}
                    ref={ref}
                    autoHide={autoHide}
                    thumbMinSize={thumbMinSize}
                    thumbSize={thumbSize}
                    onUpdate={handleUpdate}
                    renderTrackHorizontal={({style, ...trackProps}) => (
                        <div {...trackProps} className="track-horizontal" style={{...style, display: 'none'}}/>
                    )}
                    renderTrackVertical={({style, ...trackProps}) => (
                        <div {...trackProps} className="track-vertical" style={{...style, display: 'block'}}/>
                    )}
                    renderThumbHorizontal={({style, ...thumbProps}) => (
                        <div {...thumbProps} className="thumb-horizontal" style={style}/>
                    )}
                    renderThumbVertical={({style, ...thumbProps}) => (
                        <div {...thumbProps} className="thumb-vertical" style={style}/>
                    )}
                    renderView={({style, ...viewProps}) => (
                        <div
                            {...viewProps}
                            className="view"
                            style={{
                                ...style,
                                overflowX:    'hidden',
                                marginBottom:  0,
                                marginRight:   0,
                            }}
                        />
                    )}
                >
                    {children}
                </Scrollbars>
            </div>
        )
})
