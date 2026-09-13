import {execFileSync} from 'node:child_process'

const argumentsList = process.argv.slice(2)
const hasFlag = flag => argumentsList.includes(flag)
const platform = hasFlag('--test') || hasFlag('-t')
    ? 'test'
    : hasFlag('--staging') || hasFlag('-s')
        ? 'staging'
        : hasFlag('--nightly') || hasFlag('-n')
            ? 'nightly'
            : null

if (!platform || hasFlag('--prod') || hasFlag('-p')) {
    throw new Error('Use --test/-t, --staging/-s, or --nightly/-n to dispatch a GitHub deployment')
}

const currentRef = execFileSync('git', ['branch', '--show-current'], {encoding: 'utf8'}).trim()
const sourceRef = currentRef || execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim()
const workflow = platform === 'nightly' ? 'nightly.yml' : 'deploy.yml'
const workflowArguments = ['workflow', 'run', workflow]

// A detached commit can be checked out by the workflow input, but GitHub
// requires --ref to identify a branch or tag containing the workflow file.
if (currentRef) {
    workflowArguments.push('--ref', currentRef)
}

workflowArguments.push('-f', `source_ref=${sourceRef}`)

if (platform !== 'nightly') {
    workflowArguments.push('-f', `platform=${platform}`)
}

execFileSync('gh', workflowArguments, {stdio: 'inherit'})
console.log(`GitHub deployment workflow dispatched for ${platform}: https://github.com/lgs1920/studio/actions/workflows/${workflow}`)
