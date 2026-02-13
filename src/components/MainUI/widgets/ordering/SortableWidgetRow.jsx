/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SortableWidgetRow.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-13
 * Last modified: 2026-02-13
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SortableWidgetRow.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-12
 * Last modified: 2026-02-13
 *
 ******************************************************************************/

import { WIDGETS_CONFIGURATION }                                  from '@Core/constants'
import { faEye, faEyeSlash, faGripVertical, faQuestion, faTrash } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlIconButton, SlTooltip }                        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                  from '@Utils/FA2SL'

export const SortableWidgetRow = ({widget}) => {
    const widgetConf = WIDGETS_CONFIGURATION.get(widget.type)
    const iconToRender = widgetConf?.icon || faQuestion

    const handleToggleVisibility = (e) => {
        e.stopPropagation()
        // visibility logic
    }

    const handleRemove = (e) => {
        e.stopPropagation()
        // removal logic
    }

    return (
        <div className="widget-ordering-row lgs-one-line-card on-map" data-id={widget.id}>
            <SlIcon library="fa" name={FA2SL.set(iconToRender)} className="icon-widget"/>

            <div className="sortable-widget-info">
                {widget.name.length > 15 ? `${widget.name.slice(0, 15)}...` : widget.name}
            </div>

            <div className="sortable-widget-actions">
                <SlIconButton
                    library="fa"
                    name={FA2SL.set(widget.visible ? faEye : faEyeSlash)}
                    onClick={handleToggleVisibility}
                />

            </div>
        </div>
    )
}