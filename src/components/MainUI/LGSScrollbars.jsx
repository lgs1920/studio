/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGSScrollbars.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-17
 * Last modified: 2026-02-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { forwardRef } from 'react'
import { Scrollbars } from 'react-custom-scrollbars-2'

/**
 * Custom scrollbar wrapper for the LGS Studio.
 * Correctly forwards refs for SortableJS and hides native scrollbars.
 */
export const LGSScrollbars = forwardRef((props, ref) => {
    return (
        <div className="lgs-scrollbars-container" style={{width: '100%', height: '100%', overflow: 'hidden'}}>
            <Scrollbars
                className="lgs-scrollbars"
                {...props}
                ref={ref}
                autoHide
                renderTrackHorizontal={props => <div {...props} className="track-horizontal"/>}
                renderTrackVertical={props => <div {...props} className="track-vertical"/>}
                renderThumbHorizontal={props => <div {...props} className="thumb-horizontal"/>}
                renderThumbVertical={props => <div {...props} className="thumb-vertical"/>}
                renderView={({style, ...viewProps}) => (
                    <div
                        {...viewProps}
                        className="view"
                        style={{
                            ...style,
                            // Maintain native scrollbar hiding via negative margins
                            // while preventing horizontal overflow
                            overflowX:    'hidden',
                            marginBottom: style.marginBottom,
                            marginRight:  style.marginRight,
                        }}
                    />
                )}
            >
                {props.children}
            </Scrollbars>
        </div>
    )
})