/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropperCTA.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-20
 * Last modified: 2025-07-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * CropperCTA renders a call-to-action bar for the cropper interface
 * @component
 * @param {Object} props - Component props
 */
import { memo, useEffect }  from 'react'
import { faVideo, faXmark } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }            from '@Utils/FA2SL'

// Cache icon conversions
const icons = {
    cancel: FA2SL.set(faXmark),
    next:   FA2SL.set(faVideo),
}

export const CropperCTA = memo(() => {
    /**
     * Placeholder for cancel action
     */
    const handleCancel = () => {
    }

    /**
     * Placeholder for next action
     */
    const handleNext = () => {
    }


    return (
        <div className="cropper-cta call-for-actions lgs-slide-in-from-bottom">
            <div className="buttons-bar">
                <SlButton onClick={handleCancel} outline>
                    <SlIcon slot="prefix" library="fa" name={icons.cancel}/>
                    Exit
                </SlButton>
                <SlButton variant="primary" onClick={handleNext}>
                    <SlIcon slot="prefix" library="fa" name={icons.next}/>
                    Next
                </SlButton>
            </div>
        </div>
    )
})
