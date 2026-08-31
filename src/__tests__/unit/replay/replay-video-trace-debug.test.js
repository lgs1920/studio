/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-trace-debug.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-07-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { replayVideoTraceDebug } from '@Core/ui/replay/ReplayVideoTraceDebug'
import {
    beginReplayCameraExport,
    endReplayCameraExport,
} from '@Core/ui/replay/JourneyReplaySessionPlaybackController'
import {
    JOURNEY_REPLAY_INTERNAL_CALL,
    JOURNEY_REPLAY_INTERNAL_STATE,
} from '@Core/ui/replay/JourneyReplayInternal'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_TOAST_DURATION:    5000,
    LGS_WARNING_TOAST:     'warning',
    showToast:             vi.fn(),
}))

const TRACE_GLOBAL_KEY = '__lgsReplayVideoTrace'
const TRACE_CONSOLE_FLAG = '__lgsReplayVideoTraceConsole'

afterEach(() => {
    delete globalThis[TRACE_GLOBAL_KEY]
    delete globalThis[TRACE_CONSOLE_FLAG]
})

describe('replay video trace diagnostics', () => {
    it('records diagnostics without writing replay traces to the console', () => {
        const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
        globalThis[TRACE_CONSOLE_FLAG] = true

        const entry = replayVideoTraceDebug('camera.timing', {progress: 0.5})

        expect(entry.event).toBe('camera.timing')
        expect(globalThis[TRACE_GLOBAL_KEY]).toHaveLength(1)
        expect(consoleInfo).not.toHaveBeenCalled()

        consoleInfo.mockRestore()
    })

    it('traces camera export ownership transitions in the replay session', () => {
        const state = {
            replayExportCameraActive: false,
            cameraUserAdjusting: true,
            cameraPointerActive: true,
            cameraManualInteractionTimer: 1,
        }
        const call = {
            cancelCameraBezierTransition: vi.fn(),
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: state,
            [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
        }

        beginReplayCameraExport(mode)
        endReplayCameraExport(mode)

        const traceEntries = globalThis[TRACE_GLOBAL_KEY] ?? []
        const traceEvents = traceEntries.map(entry => entry.event)
        expect(traceEvents).toContain('camera.export-ownership.start')
        expect(traceEvents).toContain('camera.export-ownership.end')
        expect(state.replayExportCameraActive).toBe(false)
        expect(call.cancelCameraBezierTransition).toHaveBeenCalledWith(false)
    })
})
