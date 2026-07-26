import { readFile } from 'node:fs/promises'

/**
 * Return a normalized lowercase issue-type name when the current issue body or labels identify one.
 *
 * @param {object} params - Detection input.
 * @param {string} params.body - Issue body text.
 * @param {Array<{ name?: string }>} params.labels - Issue labels from the webhook payload.
 * @returns {string | null} The target issue type name, or null when no mapping applies.
 */
const getDesiredIssueTypeName = ({ body, labels }) => {
  const markerMatch = body.match(/<!--\s*issue-type:\s*(bug|feature)\s*-->/i)

  if (markerMatch) {
    return markerMatch[1].toLowerCase()
  }

  const normalizedLabels = new Set(
    labels.map((label) => (label.name ?? '').toLowerCase())
  )

  if (normalizedLabels.has('bug')) {
    return 'bug'
  }

  if (normalizedLabels.has('enhancement')) {
    return 'feature'
  }

  return null
}

/**
 * Execute a GraphQL request against the GitHub API.
 *
 * @param {string} token - GitHub token used for authorization.
 * @param {string} query - GraphQL query or mutation.
 * @param {Record<string, unknown>} variables - GraphQL variables.
 * @returns {Promise<any>} Parsed GraphQL response data.
 */
const graphqlRequest = async (token, query, variables) => {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'lgs1920-issue-type-sync',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  })

  const payload = await response.json()

  if (!response.ok || payload.errors) {
    const errorMessage = payload.errors
      ? JSON.stringify(payload.errors)
      : `HTTP ${response.status}`

    throw new Error(`GitHub GraphQL request failed: ${errorMessage}`)
  }

  return payload.data
}

/**
 * Sync the issue type from the issue template marker or labels.
 *
 * @returns {Promise<void>} Resolves when the issue type is synchronized.
 */
const main = async () => {
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')
  )

  const issue = event.issue

  if (!issue || issue.pull_request) {
    console.log('No issue payload to process')
    return
  }

  const token = process.env.GITHUB_TOKEN

  if (!token) {
    throw new Error('GITHUB_TOKEN is required')
  }

  const data = await graphqlRequest(
    token,
    `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issueTypes(first: 20) {
            nodes {
              id
              name
              isEnabled
            }
          }
          issue(number: $number) {
            id
            issueType {
              id
              name
            }
          }
        }
      }
    `,
    {
      owner: event.repository.owner.login,
      repo: event.repository.name,
      number: issue.number,
    }
  )

  const repository = data.repository

  if (!repository) {
    throw new Error('Repository data is missing from the GraphQL response')
  }

  const desiredIssueTypeName = getDesiredIssueTypeName({
    body: issue.body ?? '',
    labels: issue.labels ?? [],
  })

  if (!desiredIssueTypeName) {
    console.log('No issue type mapping found for this issue')
    return
  }

  const issueType = repository.issueTypes.nodes.find((currentIssueType) => {
    return (currentIssueType.name ?? '').toLowerCase() === desiredIssueTypeName
  })

  if (!issueType?.id) {
    console.log(`Issue type ${desiredIssueTypeName} is not available`)
    return
  }

  const currentIssueTypeName = repository.issue.issueType?.name?.toLowerCase() ?? null

  if (currentIssueTypeName === desiredIssueTypeName) {
    console.log(`Issue #${issue.number} already has type ${desiredIssueTypeName}`)
    return
  }

  await graphqlRequest(
    token,
    `
      mutation($issueId: ID!, $issueTypeId: ID!) {
        updateIssueIssueType(input: { issueId: $issueId, issueTypeId: $issueTypeId }) {
          issue {
            id
            issueType {
              id
              name
            }
          }
        }
      }
    `,
    {
      issueId: repository.issue.id,
      issueTypeId: issueType.id,
    }
  )

  console.log(
    `Set issue #${issue.number} type to ${desiredIssueTypeName}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
