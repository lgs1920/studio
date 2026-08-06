import {describe, expect, test} from 'vitest'
import {createBackendEnvironmentPaths, createBackendPm2Command} from '../DeploymentCommands.js'

describe('backend PM2 deployment command', () => {
    test('loads the backend-only environment and updates PM2', () => {
        const command = createBackendPm2Command({
            backendPath:     '/home/www/lgs1920/staging/backend/current',
            environmentFile: '/home/www/lgs1920/staging/backend/shared/backend.env',
            pm2Bin:           '/home/.bun/bin/pm2',
        })

        expect(command).toContain("test -r '/home/www/lgs1920/staging/backend/shared/backend.env'")
        expect(command).toContain(". '/home/www/lgs1920/staging/backend/shared/backend.env'")
        expect(command).toContain("'/home/.bun/bin/pm2' startOrRestart '/home/www/lgs1920/staging/backend/current/ecosystem.config.js'")
        expect(command).toContain('--update-env')
        expect(command).toContain("'/home/.bun/bin/pm2' save")
        expect(command).not.toContain('LGS1920_SMTP_PASSWORD')
    })

    test('rejects incomplete command options', () => {
        expect(() => createBackendPm2Command({backendPath: '/backend'})).toThrow('Backend PM2 command options are incomplete')
    })

    test('keeps the local environment outside the release and targets shared backend storage', () => {
        expect(createBackendEnvironmentPaths({
            localRoot:         '/workspace/lgs1920',
            remoteBackendRoot: '/home/www/lgs1920/production/backend',
            environmentFile:   'shared/backend.env',
        })).toEqual({
            localPath:  '/workspace/lgs1920/backend/.env',
            remotePath: '/home/www/lgs1920/production/backend/shared/backend.env',
        })
    })
})
