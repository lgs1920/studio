/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LineHeightElement.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-18
 * Last modified: 2026-06-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaIcon, WaOption, WaSelect } from '@web.awesome.me/webawesome-pro/dist/react'
import { useMemo }                    from 'react'
import { useSnapshot }                from 'valtio'

const LINE_HEIGHT_OPTIONS = [
    {v: '0.8', t: 'Compact'},
    {v: '1', t: 'Normal'},
    {v: '1.2', t: 'Comfort'},
    {v: '1.6', t: 'Wide'},
]

/**
 * Line-height selector extracted from FontsElement.
 */
export const LineHeightElement = ({id}) => {

    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)
    const _moveable = useMemo(() => __.ui.widgetManager.getMoveable(id), [id])
    const $element = $configuration?.elements?.[id] ?? $configuration.user ?? $configuration.default
    const element = configuration?.elements?.[id] ?? configuration.user ?? configuration.default

    const handleLineHeightChange = (e) => {
        if ($element) {
            $element.lineHeight = e.target.value
            _moveable?.current?.updateRect()
        }
    }

    return (
        <WaSelect className="lgs--text-widget-line-height-trigger"
                  hoist
                  placement="bottom"
                  size="s"
                  half-width
                  value={String(element?.lineHeight ?? '1')}
                  onChange={handleLineHeightChange}
        >
            <WaIcon slot="start" variant="regular" name="distribute-spacing-vertical"/>
            {LINE_HEIGHT_OPTIONS.map(opt => (
                <WaOption key={opt.v} value={opt.v}>{opt.t}</WaOption>
            ))}
        </WaSelect>
    )
}
