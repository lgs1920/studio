import {execFileSync} from 'node:child_process'
import {readFileSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'

const HISTORY_COMMIT_MESSAGE = 'docs: update commit history'
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY ?? 'lgs1920/studio'
const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL ?? 'https://github.com'

/**
 * Executes a Git command from the repository root.
 *
 * @param {string[]} argumentsList Git command arguments.
 * @param {string} repositoryRoot Absolute repository root path.
 * @returns {string} Trimmed Git command output.
 */
const runGit = (argumentsList, repositoryRoot) => execFileSync('git', argumentsList, {
    cwd: repositoryRoot,
    encoding: 'utf8',
}).trim()

/**
 * Reads all commit identifiers already documented in the history file.
 *
 * @param {string} historyContent Existing history file content.
 * @returns {Set<string>} Recorded commit identifiers.
 */
const getRecordedHashes = historyContent => new Set(
    [...historyContent.matchAll(/\/commit\/([0-9a-f]+)/gi)].map(match => match[1].toLowerCase()),
)

/**
 * Reads the commit identifier from the latest history entry.
 *
 * @param {string} historyContent Existing history file content.
 * @returns {string|null} Latest recorded commit identifier.
 */
const getLatestRecordedHash = historyContent => {
    const matches = [...historyContent.matchAll(/\/commit\/([0-9a-f]+)/gi)]
    return matches.at(-1)?.[1]?.toLowerCase() ?? null
}

/**
 * Determines whether a commit hash is represented by an exact or abbreviated history link.
 *
 * @param {string} commitHash Full commit hash.
 * @param {Set<string>} recordedHashes Commit identifiers found in the history file.
 * @returns {boolean} Whether the commit is already recorded.
 */
const isRecorded = (commitHash, recordedHashes) => [...recordedHashes].some(recordedHash => (
    commitHash.startsWith(recordedHash) || recordedHash.startsWith(commitHash)
))

/**
 * Reads reachable commits in chronological order.
 *
 * @param {string} repositoryRoot Absolute repository root path.
 * @param {string|null} sinceHash Latest recorded commit identifier.
 * @returns {Array<{hash: string, date: string, subject: string, body: string}>} Reachable commits.
 */
const getCommits = (repositoryRoot, sinceHash) => {
    const output = runGit([
        'log',
        '--reverse',
        '--format=%H%x00%cs%x00%s%x00%b%x00',
        sinceHash ? `${sinceHash}..HEAD` : 'HEAD',
    ], repositoryRoot)

    const fields = output.split('\0')
    const commits = []

    for (let index = 0; index + 3 < fields.length; index += 4) {
        const [rawHash, rawDate, rawSubject, rawBody] = fields.slice(index, index + 4)
        const hash = rawHash.trim()
        const date = rawDate.trim()
        const subject = rawSubject.trim()
        const body = rawBody.trim()

        if (hash && date && subject) {
            commits.push({hash, date, subject, body})
        }
    }

    return commits
}

/**
 * Converts a commit body into the bullet format used by the history file.
 *
 * @param {string} body Commit body.
 * @returns {string} Markdown bullet list.
 */
const formatDescription = body => {
    const lines = body
        .trim()
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)

    if (lines.length === 0) {
        return '- Recorded automatically from Git history.'
    }

    return lines
        .map(line => line.startsWith('- ') ? line : `- ${line}`)
        .join('\n')
}

/**
 * Builds a history entry for a Git commit.
 *
 * @param {{hash: string, date: string, subject: string, body: string}} commit Git commit metadata.
 * @returns {string} Markdown history entry.
 */
const buildEntry = commit => {
    const commitUrl = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/commit/${commit.hash}`

    return [
        `## ${commit.date} — [\`${commit.subject}\`](${commitUrl})`,
        '',
        formatDescription(commit.body),
    ].join('\n')
}

/**
 * Updates the history file with all reachable, undocumented commits.
 *
 * @param {boolean} checkOnly Whether to report missing entries without writing the file.
 * @returns {number} Process exit code.
 */
const updateHistory = checkOnly => {
    const repositoryRoot = runGit(['rev-parse', '--show-toplevel'], process.cwd())
    const historyPath = resolve(repositoryRoot, 'COMMIT_HISTORY.md')
    const historyContent = readFileSync(historyPath, 'utf8')
    const recordedHashes = getRecordedHashes(historyContent)
    const latestRecordedHash = getLatestRecordedHash(historyContent)
    const missingCommits = getCommits(repositoryRoot, latestRecordedHash).filter(commit => (
        commit.subject !== HISTORY_COMMIT_MESSAGE && !isRecorded(commit.hash, recordedHashes)
    ))

    if (missingCommits.length === 0) {
        console.log('COMMIT_HISTORY.md is up to date')
        return 0
    }

    console.log(`Found ${missingCommits.length} undocumented commit(s)`)

    if (checkOnly) {
        missingCommits.forEach(commit => console.log(`- ${commit.hash} ${commit.subject}`))
        return 1
    }

    const entries = missingCommits.map(buildEntry).join('\n\n')
    const nextContent = `${historyContent.trimEnd()}\n\n${entries}\n`

    writeFileSync(historyPath, nextContent)
    return 0
}

const checkOnly = process.argv.includes('--check')
process.exitCode = updateHistory(checkOnly)
