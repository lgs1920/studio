/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropZoneInfoPopup.jsx
 *
 ******************************************************************************/

import { useEffect, useId, useRef, useState } from 'react'
import { CropZoneInfo } from './CropZoneInfo'

/**
 * Compact crop information control displayed in the lower-right corner of a crop zone.
 */
export const CropZoneInfoPopup = ({id, infoComponent, showDimensions = true}) => {
    const generatedId = useId().replace(/:/g, '')
    const anchorId = `crop-zone-info-trigger-${generatedId}`
    const controlRef = useRef(null)
    const [active, setActive] = useState(false)

    useEffect(() => {
        if (!active) {
            return undefined
        }

        const closeOnOutsidePointerDown = (event) => {
            if (!controlRef.current?.contains(event.target)) {
                setActive(false)
            }
        }
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') {
                setActive(false)
            }
        }

        document.addEventListener('pointerdown', closeOnOutsidePointerDown)
        window.addEventListener('keydown', closeOnEscape)
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointerDown)
            window.removeEventListener('keydown', closeOnEscape)
        }
    }, [active])

    return (
        <div ref={controlRef} className="crop-info-popup-control">
            <wa-button
                id={anchorId}
                className="wa-theme-lgs1920-on-map"
                appearance="outlined"
                type="button"
                aria-label="Afficher les informations de la zone de recadrage"
                aria-expanded={active}
                onClick={() => setActive(value => !value)}
            >
                <wa-icon slot="start" name="circle-info" variant="regular"/>
                Infos
            </wa-button>
            {active && (
                <div className="crop-info-popup-card lgs-card wa-theme-lgs1920-on-map small" role="dialog" aria-label="Informations de la zone de recadrage">
                    {showDimensions && (
                        <div className="crop-info-popup-dimensions">
                            <CropZoneInfo id={id}/>
                        </div>
                    )}
                    {infoComponent && (
                        <div className="crop-info-popup-custom">
                            {infoComponent}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
