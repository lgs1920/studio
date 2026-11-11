/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StartupErrorBoundary.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-11
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {InitErrorMessage} from '@Components/InitErrorMessage'
import {Component} from 'react'

/** Catch fatal React startup rendering errors and show the standard diagnostic dialog. */
export class StartupErrorBoundary extends Component {
    state = {error: null}

    static getDerivedStateFromError(error) {
        return {error}
    }

    componentDidCatch(error, errorInfo) {
        console.log('[LGS1920][Startup] React rendering failed.', {
            error,
            message: error?.message ?? String(error),
            stack: error?.stack ?? null,
            componentStack: errorInfo?.componentStack ?? null,
            cause: error?.cause ?? null,
        })
    }

    render() {
        return this.state.error
            ? <InitErrorMessage error={this.state.error}/>
            : this.props.children
    }
}
