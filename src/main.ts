import * as core from '@actions/core'
import * as github from '@actions/github'

import { GitHub } from '@actions/github/lib/utils'

import { formatNameWithOwner } from './utils'

interface IssueNumber {
  number: number
}

export type GitHubClient = InstanceType<typeof GitHub>
export type GraphQlQueryResponseData = { [key: string]: any } | null

const query = `
query($searchQuery: String!) {
  search(first: 100, query: $searchQuery, type: ISSUE) {
    nodes {
      ... on Issue {
        number
      }
    }
  }
}
`

async function closeIssues(octokit: GitHubClient, numbers: Array<number>) {
  const context = github.context
  const comment = core.getInput('comment')

  return numbers.map(async (number) => {
    core.info(`Close https://github.com/${formatNameWithOwner(context.repo)}/issues/${number}`)

    if (comment) {
      await octokit.issues.createComment({ ...context.repo, issue_number: number, body: comment })
    }

    return octokit.issues.update({ ...context.repo, issue_number: number, state: 'closed' })
  })
}

export async function getIssueNumbers(
  octokit: GitHubClient,
  searchQuery: string
): Promise<Array<number>> {
  const context = github.context
  const queryText = `repo:${formatNameWithOwner(context.repo)} ${searchQuery}`

  core.info(`Query: ${queryText}`)

  const results: GraphQlQueryResponseData = await octokit.graphql(query, { searchQuery: queryText })

  core.info(`Results: ${JSON.stringify(results)}`)

  if (results) {
    return results.search.nodes.map((issue: IssueNumber) => issue.number)
  } else {
    return []
  }
}

async function run() {
  try {
    const token = core.getInput('token')

    if (!token) {
      throw new Error('`token` is a required input parameter')
    }

    const searchQuery = core.getInput('query')

    if (!searchQuery) {
      throw new Error('`query` is a required input parameter')
    }

    const octokit = github.getOctokit(token)

    const issueNumbers = await getIssueNumbers(octokit, searchQuery)

    await closeIssues(octokit, issueNumbers)

    core.setOutput('num', String(issueNumbers.length))
    core.info(`Issues: ${issueNumbers}`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
