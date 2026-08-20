/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LogoWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-16
 * Last modified: 2026-07-16
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LogoSvg }                                     from '@Components/MainUI/LogoSvg'
import { Widget }                                      from '@Components/MainUI/widgets/Widget'
import { HOUR, LGS_VISUAL_WIDGET, MULTI_PURPOSE_WIDGETS, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { shouldRenderVideoBoardWidget }                from '@Core/ui/replay/ReplayOverlayResolver'
import { useOptionalSnapshot }                         from '@Utils/ValtioUtils'
import { useMemo }                                     from 'react'
import { useSnapshot }                                 from 'valtio'
import './logo-widget.css'

const LOGO_WIDGET_CONTEXT_FALLBACK = {widgetEditor: false, widgetsBoard: ''}
const LOGO_WIDGET_Z_INDEX = 10001
const LOGO_WIDGET_SVG_STYLE = {height: '100%'}

/**
 * Mandatory LGS1920 logo widget for widget boards.
 * @param {Object} props
 * @param {string} props.id - Unique widget instance id
 * @param {Object} props.context - Valtio proxy context containing widgetsBoard and widgetEditor
 * @returns {JSX.Element|null}
 */
export const LogoWidget = ({id, context, zIndex, widgetsBoard: persistedWidgetsBoard}) => {
    const contextState = useOptionalSnapshot(context, LOGO_WIDGET_CONTEXT_FALLBACK)
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const widgetEditor = contextState.widgetEditor
    const widgetsBoard = contextState.widgetsBoard || persistedWidgetsBoard || ''
    const shouldRender = shouldRenderVideoBoardWidget({
        widgetsBoard,
        widgetEditor,
        video,
        replay,
    })
    const container = useMemo(
        () => __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard),
        [widgetsBoard],
    )
    const siteUrl = __.app.buildUrl(lgs?.configuration?.website || 'https://lgs1920.fr')
    const logoWidgetMargin = lgs.gutter?.xs ?? 5

    const config = useMemo(() => {
        return {
            container,
            contextMenu:     {
                canReset:    false,
                canMaximize: false,
                canPosition: false,
                canEdit:     false,
                canRemove:   false,
                canSnapshot: false,
            },
            top:             '100%',
            left:            '100%',
            type:            LGS_VISUAL_WIDGET,
            group:           MULTI_PURPOSE_WIDGETS,
            margin:          logoWidgetMargin,
            attachTo:        'bottom-right',
            draggable:       false,
            resizable:       false,
            scalable:        false,
            rotatable:       false,
            showControlBox:  false,
            canLock:         false,
            id,
            persist:         false,
            transient:       true,
            dynamic:         true,
            ttl:             HOUR,
            mandatory:       true,
            stopPropagation: true,
            widgetsBoard:    widgetsBoard,
            zIndex:          zIndex ?? LOGO_WIDGET_Z_INDEX,
        }
    }, [container, id, logoWidgetMargin, widgetsBoard, zIndex])

    if (!shouldRender || !container) {
        return null
    }

    return (
        <Widget isVisible={true} config={config} className="lgs-logo-widget-shell">
            <div className="lgs-logo-widget">
                <a
                    className="lgs-logo-widget-link"
                    href={siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="LGS1920 website"
                >
                    <LogoSvg
                        src="/assets/logo/logo-vertical.svg"
                        primaryColor="#ffffff"
                        secondaryColor="#ffffff"
                        secondaryOpacity={0}
                        textPrimaryColor="#ffffff"
                        textSecondaryColor="#ffffff"
                        className="lgs-logo-widget-logo"
                        style={LOGO_WIDGET_SVG_STYLE}
                        title="LGS1920 logo"
                    />
                </a>
            </div>
        </Widget>
    )
}
