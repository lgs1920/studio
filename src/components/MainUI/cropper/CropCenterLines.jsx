/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropCenterLines.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-21
 * Last modified: 2025-07-21
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * CropCenterLines component for displaying alignment guides during cropping
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.interactionState - Current interaction state
 * @param {Object} props.styles - Styles object containing center line styles
 * @returns {JSX.Element} The center lines container with conditional lines
 */
import { memo } from 'react'

export const CropCenterLines = memo(({ interactionState, styles }) => {
    return (
        <div className="center-lines-container">
            {interactionState.showHCenterLine && (
                <>
                    <div className="center-line-horizontal-left" style={styles.hCenterLineLeftStyle} />
                    <div className="center-line-horizontal-right" style={styles.hCenterLineRightStyle} />
                </>
            )}
            {interactionState.showVCenterLine && (
                <>
                    <div className="center-line-vertical-top" style={styles.vCenterLineTopStyle} />
                    <div className="center-line-vertical-bottom" style={styles.vCenterLineBottomStyle} />
                </>
            )}
        </div>
    )
})