/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: useWidgetScaleCorrection.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { resolveWidgetScaleCorrection, WIDGET_SCALE_CHANGED_EVENT } from '@Core/ui/widget-manager/widgetScaleUtils'
import { useCallback, useEffect, useState }                         from 'react'

export const useWidgetScaleCorrection = (id) => {
    const readCorrection = useCallback(() => {
        return resolveWidgetScaleCorrection(id)
    }, [id])

    const [correction, setCorrection] = useState(readCorrection)

    useEffect(() => {
        let frame = null

        const update = () => {
            if (frame !== null) {
                return
            }

            frame = requestAnimationFrame(() => {
                frame = null
                const next = readCorrection()
                setCorrection(previous => Math.abs(previous - next) > 0.001 ? next : previous)
            })
        }

        const handleScaleChange = (event) => {
            if (!id || event.detail?.id !== id) {
                return
            }
            update()
        }

        update()
        window.addEventListener(WIDGET_SCALE_CHANGED_EVENT, handleScaleChange)

        return () => {
            if (frame !== null) {
                cancelAnimationFrame(frame)
            }
            window.removeEventListener(WIDGET_SCALE_CHANGED_EVENT, handleScaleChange)
        }
    }, [id, readCorrection])

    return correction
}
