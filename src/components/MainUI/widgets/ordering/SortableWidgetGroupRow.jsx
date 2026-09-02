/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SortableWidgetGroupRow.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-02
 * Last modified: 2026-09-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaDetails, WaIcon} from '@web.awesome.me/webawesome-pro/dist/react'
import {SortableWidgetRow} from './SortableWidgetRow'

/**
 * Render a collapsible group row with non-draggable widget members.
 *
 * @param {Object} props - Component properties.
 * @param {Object} props.group - Group entry and its member widgets.
 * @returns {JSX.Element} Group row.
 */
export const SortableWidgetGroupRow = ({group}) => {
    return (
        <div className="widget-ordering-group" data-id={group.id}>
            <WaDetails open
                       appearance="outlined"
                       iconPlacement="end"
                       className="widget-ordering-group-details"
            >
                <div slot="summary" className="widget-ordering-group-summary widget-ordering-group-handle">
                    <WaIcon name="grip-dots-vertical" variant="solid" className="icon-widget"/>&nbsp;
                    <div className="sortable-widget-info">
                        {group.label ?? group.id}
                    </div>
                </div>
                <div className="widget-ordering-group-members">
                    {group.members.map(widget => (
                        <SortableWidgetRow key={widget.id} widget={widget} draggable={false}/>
                    ))}
                </div>
            </WaDetails>
        </div>
    )
}
