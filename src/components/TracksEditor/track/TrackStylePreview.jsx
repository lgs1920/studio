/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackStylePreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { normalizeTrackRenderStyle } from '@Utils/cesium/trackRenderStyle'
import { useOptionalSnapshot }       from '@Utils/ValtioUtils'
import classNames                    from 'classnames'

export const TrackStylePreview = ({
                                      track = null,
                                      renderStyle = null,
                                      className = undefined,
                                      compact = false,
                                      visible = undefined,
                                      slot = undefined,
                                  }) => {
    const trackSnap = useOptionalSnapshot(track)
    const style = normalizeTrackRenderStyle(renderStyle ?? trackSnap?.renderStyle, {
        color:     trackSnap?.color,
        thickness: trackSnap?.thickness,
    })
    const isVisible = visible ?? trackSnap?.visible

    return (
        <span
            slot={slot}
            className={classNames('lgs--track-style-preview', className, {
                'has-underlay': style.underlay.enabled,
                'is-dashed':    style.dash.enabled,
                'is-compact':   compact,
                'is-hidden':    isVisible === false,
            })}
            style={{
                '--lgs-track-preview-color':       style.color,
                '--lgs-track-preview-dash-color':  style.dash.color,
                '--lgs-track-preview-gap-color':   style.dash.gapColor,
                '--lgs-track-preview-underlay':    style.underlay.color,
                '--lgs-track-preview-dash-length': `${Math.max(4, Math.min(18, style.dash.dashLength)) / 10}rem`,
                '--lgs-track-preview-gap-length':  `${Math.max(4, Math.min(18, style.dash.gapLength)) / 10}rem`,
            }}
            aria-hidden="true"
        >
            <span className="lgs--track-style-preview-underlay"/>
            <span className="lgs--track-style-preview-line"/>
        </span>
    )
}
