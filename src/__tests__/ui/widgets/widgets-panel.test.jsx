import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proxy } from 'valtio'
import { LGS_WIDGET } from '@Core/constants'

const widgetState = vi.hoisted(() => ({
    configs: [],
}))

vi.mock('@Components/MainUI/widgets/Widget', () => ({
    Widget: ({children, config}) => {
        widgetState.configs.push(config)
        return <div data-testid="widget">{children}</div>
    },
}))

vi.mock('@Components/MainUI/widgets/WidgetsPanelContent', () => ({
    WidgetsPanelContent: () => <div data-testid="widgets-panel-content"/>,
}))

vi.mock('@Components/MainUI/compass/Compass', () => ({
    Compass: () => <div/>,
}))

import { WidgetsPanel } from '@Components/MainUI/widgets/WidgetsPanel'

describe('WidgetsPanel', () => {
    beforeEach(() => {
        widgetState.configs = []
        globalThis.lgs = {
            canvas: document.createElement('div'),
        }
    })

    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
    })

    it('renders the widget deck as a non-snappable generic widget', () => {
        const context = proxy({widgetEditor: true})

        render(<WidgetsPanel id="widget-deck" context={context} groups={[]}/>)

        expect(screen.getByTestId('widgets-panel-content')).not.toBeNull()
        expect(widgetState.configs[0]).toMatchObject({
            id:        'widget-deck',
            type:      LGS_WIDGET,
            snappable: false,
        })
    })
})
