import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path              from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const oxlintBinary = path.join(projectRoot, 'node_modules', '.bin', 'oxlint')
const fixtureRoot = path.join(projectRoot, 'scripts', 'fixtures', 'oxlint')

/**
 * Runs Oxlint against one migration fixture and verifies its exit status.
 *
 * @param {string[]} argumentsList - Oxlint command-line arguments.
 * @param {number} expectedStatus - Expected process exit status.
 * @returns {string} Combined Oxlint output.
 */
const runOxlint = (argumentsList, expectedStatus) => {
    const result = spawnSync(oxlintBinary, argumentsList, {
        cwd: projectRoot,
        encoding: 'utf8',
    })
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`

    if (result.status !== expectedStatus) {
        throw new Error(`Expected Oxlint exit status ${expectedStatus}, received ${result.status}\n${output}`)
    }

    return output
}

/**
 * Asserts that a migration fixture produces the expected Oxlint diagnostic.
 *
 * @param {string} fixtureName - Fixture file name relative to the fixture directory.
 * @param {string} ruleName - Expected rule identifier in the diagnostic output.
 * @returns {void}
 */
const assertRuleDiagnostic = (fixtureName, ruleName) => {
    const output = runOxlint([
        '--type-aware',
        '--no-ignore',
        '--config',
        path.join(projectRoot, '.oxlintrc.migration-test.jsonc'),
        '--deny-warnings',
        path.join(fixtureRoot, fixtureName),
    ], 1)

    if (!output.includes(ruleName)) {
        throw new Error(`Expected ${ruleName} in Oxlint output for ${fixtureName}\n${output}`)
    }
}

runOxlint([
    '--type-aware',
    '--no-ignore',
    '--config',
    path.join(projectRoot, '.oxlintrc.migration-test.jsonc'),
    path.join(fixtureRoot, 'typescript-and-tsx.tsx'),
], 0)

assertRuleDiagnostic('react-hooks.jsx', 'rules-of-hooks')
assertRuleDiagnostic('react-refresh.jsx', 'only-export-components')

const unusedDisableOutput = runOxlint([
    '--type-aware',
    '--no-ignore',
    '--config',
    path.join(projectRoot, '.oxlintrc.migration-test.jsonc'),
    '--report-unused-disable-directives-severity',
    'error',
    path.join(fixtureRoot, 'unused-disable.jsx'),
], 1)

if (!unusedDisableOutput.includes('Unused oxlint-disable directive')) {
    throw new Error(`Expected unused disable diagnostic\n${unusedDisableOutput}`)
}

runOxlint([
    '--type-aware',
    '--no-ignore',
    path.join(projectRoot, 'src', 'core', 'MapTarget.js'),
], 0)
