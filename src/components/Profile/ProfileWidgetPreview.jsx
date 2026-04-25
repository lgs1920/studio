/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-25
 * Last modified: 2026-04-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ProfileWidgetPreview.jsx
 *
 ******************************************************************************/

import { ProfileChart }                               from './ProfileChart'
import { useLayoutEffect, useRef, useState } from 'react'
import { useSnapshot }                                from 'valtio'

/**
 * Renders a visual preview for the Profile Widget.
 * Ensures scale and tick consistency by mirroring the Editor logic.
 */
export const ProfileWidgetPreview = ({entity}) => {
    const $unitSystem = lgs.settings.unitSystem
    const currentUnit = useSnapshot($unitSystem).current

    const _preview = useRef(null)
    const [previewSize, setPreviewSize] = useState({width: 0, height: 0})

    // Reuse the exact same dataset as the live profile widget.
    const realData = __.ui.profiler?.prepareData()

    useLayoutEffect(() => {
        if (!_preview.current) {
            return
        }

        const updateSize = () => {
            const element = _preview.current
            const rect = element.getBoundingClientRect()
            const styles = window.getComputedStyle(element)
            const horizontalPadding = (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0)
            const verticalPadding = (Number.parseFloat(styles.paddingTop) || 0) + (Number.parseFloat(styles.paddingBottom) || 0)
            const width = rect.width - horizontalPadding
            const height = rect.height - verticalPadding

            if (width > 0 && height > 0) {
                setPreviewSize({width, height})
            }
        }

        updateSize()
        const _observer = new ResizeObserver(updateSize)
        _observer.observe(_preview.current)
        return () => _observer.disconnect()
    }, [])

    const previewStyle = {
        width:                      '100%',
        display:                    'flex',
        alignItems:                 'center',
        justifyContent:             'center',
        position:                   'relative',
        background: 'transparent',
    }

    return (
        <div className="profile-widget-preview-surface" ref={_preview} style={previewStyle}
             data-unit-system={currentUnit}>
            {previewSize.width > 0 && previewSize.height > 0 && realData && (
                <div style={{width: `${previewSize.width}px`, height: `${previewSize.height}px`, position: 'relative'}}>
                    <ProfileChart
                        preview
                        data={realData}
                        id={entity}
                        height={previewSize.height}
                        width={previewSize.width}
                    />
                </div>
            )}
        </div>
    )
}
