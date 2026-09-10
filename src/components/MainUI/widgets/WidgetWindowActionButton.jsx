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
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaButton, WaIcon} from '@web.awesome.me/webawesome-pro/dist/react'

/**
 * Render a consistent icon-only action for docked and detached widget frames.
 *
 * @param {Object} props - Action properties.
 * @param {string} props.icon - Font Awesome icon name.
 * @param {string} props.label - Accessible and visible tooltip label.
 * @param {() => void} props.onClick - Action callback.
 * @returns {JSX.Element} Widget window action button.
 */
export const WidgetWindowActionButton = ({icon, label, onClick}) => (
    <WaButton size="s" appearance="plain" variant="neutral"
              aria-label={label} title={label} onClick={onClick}>
        <WaIcon name={icon} library="system" variant="regular"/>
    </WaButton>
)
