/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGSScrollbars.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-30
 * Last modified: 2026-01-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import Scrollbars from 'react-custom-scrollbars'

// https://github.com/RobPethick/react-custom-scrollbars-2/blob/master/docs/customization.md
export const LGSScrollbars = (props) => {
    return (
        <div className="lgs-scrollbars-container" style={{width: '100%', height: '100%'}}>
        <Scrollbars className="lgs-scrollbars" {...props} autoHide
                    renderTrackHorizontal={props => <div {...props} className="track-horizontal"/>}
                    renderTrackVertical={props => <div {...props} className="track-vertical"/>}
                    renderThumbHorizontal={props => <div {...props} className="thumb-horizontal"/>}
                    renderThumbVertical={props => <div {...props} className="thumb-vertical"/>}
                    renderView={props => {
                        const viewStyle = props.style || {}
                        const marginRight = Number(viewStyle.marginRight) || 0
                        const marginBottom = Number(viewStyle.marginBottom) || 0
                        return (
                            <div
                                {...props}
                                className="view"
                                style={{
                                    ...viewStyle,
                                    marginRight:   0,
                                    marginBottom:  0,
                                    paddingRight:  Math.max(0, -marginRight),
                                    paddingBottom: Math.max(0, -marginBottom),
                                }}
                            />
                        )
                    }}>
            {props.children}
        </Scrollbars>
        </div>
    )
}
