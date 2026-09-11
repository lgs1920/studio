/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetWindowActionButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-10
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaButton, WaIcon, WaTooltip} from '@web.awesome.me/webawesome-pro/dist/react'
import {useId} from 'react'

const WIDGET_WINDOW_ACTION_FONT_SIZE = 'var(--wa-font-size-m)'

/**
 * Render a consistent icon-only action for docked and detached widget frames.
 *
 * @param {Object} props - Action properties.
 * @param {string} props.icon - Font Awesome icon name.
 * @param {string} [props.library] - Optional Web Awesome icon library name.
 * @param {string} props.label - Accessible and visible tooltip label.
 * @param {'m'|'l'} [props.size='m'] - Web Awesome button size.
 * @param {() => void} props.onClick - Action callback.
 * @returns {JSX.Element} Widget window action button.
 */
export const WidgetWindowActionButton = ({icon, library, label, onClick, size = 'm'}) => {
    const reactId = useId()
    const buttonId = `widget-window-action-${reactId.replaceAll(':', '')}`

    return (
        <>
            <WaButton id={buttonId} size={size} appearance="plain" variant="neutral"
                      style={{fontSize: WIDGET_WINDOW_ACTION_FONT_SIZE}}
                      aria-label={label} onClick={onClick}>
                <WaIcon {...(library ? {library} : {})} name={icon} variant="regular"/>
            </WaButton>
            <WaTooltip for={buttonId} placement="bottom">{label}</WaTooltip>
        </>
    )
}
