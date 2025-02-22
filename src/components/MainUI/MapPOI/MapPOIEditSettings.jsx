/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 *
 * File: MapPOIEditSettings.jsx
 * Path: /home/christian/devs/assets/lgs1920/studio/src/components/MainUI/MapPOI/MapPOIEditSettings.jsx
 *
 * Author : Christian Denat
 * email: christian.denat@orange.fr
 *
 * Created on: 2025-02-22
 * Last modified: 2025-02-22
 *
 *
 * Copyright © 2025 LGS1920
 *
 ******************************************************************************/

import { SlSwitch } from '@shoelace-style/shoelace/dist/react'
import React        from 'react'

export const MapPOIEditSettings = () => {
    const switchValue = (event) => {
        if (window.isOK(event)) {
            return event.target.checked
        }
    }
    return (
        <div id="map-poi-edit-settings">
            <SlSwitch size="small" align-right checked={lgs.settings.ui.poi.focusOnEdit}
                      onSlChange={
                          (event) => {
                              lgs.settings.ui.poi.focusOnEdit = switchValue(event)
                          }
                      }>
                {'Focus on POI'}
            </SlSwitch>
        </div>
    )
}