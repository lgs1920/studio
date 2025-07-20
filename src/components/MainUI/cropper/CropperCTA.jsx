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
import { faRegularRouteCirclePlus } from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { faGlobePointer }           from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon }         from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                    from '@Utils/FA2SL'

export const CropperCTA = props => {
    return (
        <div className="cropper-cta call-for-actions lgs-slide-in-from-bottom">
            <div className="buttons-bar">
                <SlButton
                    target="_blank"
                    outline>
                    <SlIcon slot="prefix" library="fa"
                            name={FA2SL.set(faGlobePointer)}/>
                    {'Exit'}
                </SlButton>


                <SlButton variant="primary">
                    <SlIcon slot="prefix" library="fa"
                            name={FA2SL.set(faRegularRouteCirclePlus)}/>
                    <span>{'Next'}</span>

                </SlButton>
            </div>
        </div>
    )
}