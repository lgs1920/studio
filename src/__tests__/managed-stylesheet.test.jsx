/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: managed-stylesheet.test.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { cleanup, render }       from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CSSUtils }              from '../Utils/CSSUtils'
import { useManagedStylesheet }  from '../Utils/useManagedStylesheet'

const STYLESHEET_ID = 'journey-stats-widget'
const STYLESHEET_HREF = '/assets/css/journey-stats-widget.css'
const MANAGED_STYLESHEET_SELECTOR = 'link[data-lgs-managed-stylesheet]'

const managedStylesheetLinks = () => Array.from(document.head.querySelectorAll(MANAGED_STYLESHEET_SELECTOR))

const ManagedStylesheetConsumer = ({id = STYLESHEET_ID, href = STYLESHEET_HREF}) => {
    useManagedStylesheet(id, href)

    return <div data-testid={id}/>
}

describe('useManagedStylesheet', () => {
    afterEach(() => {
        cleanup()
        CSSUtils.clearManagedStylesheets()
        document.head.innerHTML = ''
        document.body.innerHTML = ''
    })

    it('mounts a stylesheet link and removes it on unmount', () => {
        const view = render(<ManagedStylesheetConsumer/>)

        expect(managedStylesheetLinks()).toHaveLength(1)
        expect(managedStylesheetLinks()[0].rel).toBe('stylesheet')
        expect(managedStylesheetLinks()[0].getAttribute('href')).toBe(STYLESHEET_HREF)
        expect(managedStylesheetLinks()[0].getAttribute('data-lgs-managed-stylesheet')).toBe(STYLESHEET_ID)

        view.unmount()

        expect(managedStylesheetLinks()).toHaveLength(0)
    })

    it('does not duplicate links and waits for the last consumer before removing', () => {
        const firstView = render(<ManagedStylesheetConsumer/>)
        const secondView = render(<ManagedStylesheetConsumer/>)

        expect(managedStylesheetLinks()).toHaveLength(1)

        firstView.unmount()

        expect(managedStylesheetLinks()).toHaveLength(1)

        secondView.unmount()

        expect(managedStylesheetLinks()).toHaveLength(0)
    })
})
