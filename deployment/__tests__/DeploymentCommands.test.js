import {describe, expect, test} from 'vitest'
import {
    createBackendEnvironmentContent,
    createBackendEnvironmentPaths,
    createBackendPm2Command,
    generateContactCsrfSecret,
    validateBackendEnvironmentContent,
} from '../DeploymentCommands.js'

describe('backend environment secret rotation', () => {
    test('generates a cryptographically sized secret', () => {
        const secret = generateContactCsrfSecret()

        expect(secret).toMatch(/^[a-f0-9]{64}$/)
    })

    test('replaces an existing secret in the transferred environment', () => {
        const content = 'LGS1920_SMTP_HOST=smtp.webmo.fr\nLGS1920_CONTACT_CSRF_SECRET=old-secret\n'
        const updatedContent = createBackendEnvironmentContent(content, 'new-secret')

        expect(updatedContent).toBe('LGS1920_SMTP_HOST=smtp.webmo.fr\nLGS1920_CONTACT_CSRF_SECRET=new-secret\n')
        expect(updatedContent).not.toContain('old-secret')
    })

    test('adds the secret when the environment does not define it', () => {
        expect(createBackendEnvironmentContent('LGS1920_SMTP_HOST=smtp.webmo.fr', 'new-secret'))
            .toBe('LGS1920_SMTP_HOST=smtp.webmo.fr\nLGS1920_CONTACT_CSRF_SECRET=new-secret\n')
    })

    test('rejects shell metacharacters in unquoted environment values', () => {
        expect(() => validateBackendEnvironmentContent('LGS1920_SMTP_PASSWORD=secret&value'))
            .toThrow('Backend environment line 1 for LGS1920_SMTP_PASSWORD must quote shell characters')
    })

    test('accepts quoted shell metacharacters in environment values', () => {
        expect(() => validateBackendEnvironmentContent('LGS1920_SMTP_PASSWORD=\'secret&value\''))
            .not.toThrow()
    })
})

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
