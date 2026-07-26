import { replayVideoTraceDebug } from '@Core/ui/replay/ReplayVideoTraceDebug'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
})
