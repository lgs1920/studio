// @vitest-environment jsdom
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: widget-window-action-button.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-11
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {render} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button type="button" {...props}>{children}</button>,
    WaIcon: ({name, ...props}) => <span data-icon={name} {...props}/>,
}))

import {WidgetWindowActionButton} from '@Components/MainUI/widgets/WidgetWindowActionButton'

describe('WidgetWindowActionButton', () => {
    it('keeps Web Awesome default library selection when no library is provided', () => {
        const {container} = render(
            <WidgetWindowActionButton icon="picture-in-picture" label="Open in Picture-in-Picture" onClick={() => {}}/>,
        )

        const icon = container.querySelector('[data-icon="picture-in-picture"]')
        expect(icon?.getAttribute('data-icon')).toBe('picture-in-picture')
        expect(icon?.hasAttribute('library')).toBe(false)
    })

    it('passes an explicit library for custom kit icons', () => {
        const {container} = render(
            <WidgetWindowActionButton icon="picture-in-picture-out" library="lgs1920"
                                      label="Reattach to widget" onClick={() => {}}/>,
        )

        expect(container.querySelector('[data-icon="picture-in-picture-out"]')?.getAttribute('library')).toBe('lgs1920')
    })
})
