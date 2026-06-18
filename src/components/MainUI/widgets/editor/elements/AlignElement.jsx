/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AlignElement.jsx
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

import { WaButton, WaButtonGroup, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useMemo }              from 'react'
import { useSnapshot }                     from 'valtio'

const ALIGNMENT_MODES = ['left', 'center', 'right']

/**
 * Text alignment controls extracted from TextEditorToolbar.
 */
export const AlignElement = ({id}) => {
    const $configuration = lgs.settings.widgets['text-widget'].configuration
    const configuration = useSnapshot($configuration)
    const _moveable = useMemo(() => __.ui.widgetManager.getMoveable(id), [id])
    const $element = $configuration?.elements?.[id] ?? $configuration.user ?? $configuration.default
    const element = configuration?.elements?.[id] ?? configuration.user ?? configuration.default

    const alignmentDisabled = useMemo(() => {
        const text = element?.text?.content ?? ''
        return text.split('\n').filter(line => line.trim() !== '').length <= 1
    }, [element?.text?.content])

    useEffect(() => {
        if (alignmentDisabled && $element && $element.align !== 'left') {
            $element.align = 'left'
        }
    }, [alignmentDisabled, $element])

    return (
        <WaButtonGroup size="s">
            {ALIGNMENT_MODES.map((mode) => (
                <WaButton
                    key={mode}
                    size="xs"
                    disabled={alignmentDisabled}
                    variant={!alignmentDisabled && element?.align === mode ? 'brand' : 'default'}
                    onClick={() => {
                        if ($element) {
                            $element.align = mode
                        }
                        _moveable?.current?.updateRect()
                    }}
                >
                    <WaIcon
                        variant="regular"
                        name={mode === 'left' ? 'align-left' : mode === 'center' ? 'align-center' : 'align-right'}
                    />
                </WaButton>
            ))}
        </WaButtonGroup>
    )
}
