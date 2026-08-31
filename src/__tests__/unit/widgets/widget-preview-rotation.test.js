/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-preview-rotation.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-22
 * Last modified: 2026-08-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { syncWidgetPreviewRotation } from '@Core/ui/widget-manager/WidgetPreviewRotation'
import { describe, expect, it } from 'vitest'

describe('Widget preview rotation', () => {
    it('updates the preview stage directly without rendering the widget again', () => {
        const previewZone = document.createElement('section')
        previewZone.className = 'editor-preview-zone lgs-widget-preview'
        previewZone.dataset.widgetPreviewEntity = 'text-widget#1'
        const previewStage = document.createElement('div')
        previewStage.dataset.widgetPreviewRotationStage = ''
        previewZone.appendChild(previewStage)
        document.body.appendChild(previewZone)

        syncWidgetPreviewRotation('text-widget#1', 12.345)

        expect(previewStage.style.transform).toBe('rotate(12.345deg)')
        expect(previewStage.dataset.widgetPreviewRotation).toBe('12.345')

        previewZone.remove()
    })
})
