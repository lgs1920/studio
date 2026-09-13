#!/usr/bin/env bun
/**
 * *******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: normalize-todo-on-save.mjs
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-11
 * Last modified: 2026-09-11
 *
 *
 * Copyright © 2026 LGS1920
 * *******************************************************************************
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptDirectory, '..')
const todoPath = join(projectRoot, 'TODO.md')
const bunBinDirectory = '/home/christian/.bun/bin'
const statePath = join(tmpdir(), `lgs1920-todo-normalize-${createHash('sha256').update(projectRoot).digest('hex').slice(0, 16)}.hash`)

const prompt = `Normalize TODO.md after a WebStorm save.

Read the complete TODO.md file. Rewrite notes that are newly edited or not yet clear, self-contained English implementation requests for an LLM. Preserve already clear English entries, the original intent, explicit constraints, references, uncertainty, and deleted sections. Do not invent requirements. Modify only TODO.md. Do not stage, commit, or modify any other file. If the file already follows the rule, leave it unchanged.`

/**
 * Resolve the Codex executable available in the current WSL environment.
 *
 * @returns {string} The Codex executable path.
 */
const resolveCodex = () => {
  try {
    return execFileSync('which', ['codex'], {encoding: 'utf8'}).trim()
  } catch {
    const jetBrainsRoot = '/home/christian/.cache/JetBrains'

    if (existsSync(jetBrainsRoot)) {
      for (const productDirectory of readdirSync(jetBrainsRoot)) {
        if (!productDirectory.startsWith('WebStorm')) {
          continue
        }

        const codexRoot = join(jetBrainsRoot, productDirectory, 'acp-agents', 'codex-acp')

        if (!existsSync(codexRoot)) {
          continue
        }

        for (const versionDirectory of readdirSync(codexRoot).reverse()) {
          const candidate = join(codexRoot, versionDirectory, 'node_modules', '.bin', 'codex')

          if (existsSync(candidate)) {
            return candidate
          }
        }
      }
    }

    throw new Error('The Codex executable could not be found in WSL.')
  }
}

/**
 * Calculate the current TODO.md content hash.
 *
 * @returns {string} The content hash.
 */
const getTodoHash = () => createHash('sha256').update(readFileSync(todoPath)).digest('hex')

/**
 * Determine whether the current content was already processed by this watcher.
 *
 * @returns {boolean} Whether the content hash matches the last processed hash.
 */
const wasAlreadyProcessed = () => existsSync(statePath) && readFileSync(statePath, 'utf8').trim() === getTodoHash()

/**
 * Store the content hash after a successful Codex run.
 *
 * @returns {void}
 */
const rememberProcessedContent = () => writeFileSync(statePath, `${getTodoHash()}\n`)

if (!existsSync(todoPath)) {
  process.exit(0)
}

if (wasAlreadyProcessed()) {
  process.exit(0)
}

try {
  execFileSync(resolveCodex(), [
    'exec',
    '--ephemeral',
    '--approve-for-me',
    '--cd',
    projectRoot,
    prompt,
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PATH: `${bunBinDirectory}:${process.env.PATH ?? ''}`,
    },
    stdio: 'inherit',
  })
  rememberProcessedContent()
} catch (error) {
  const exitCode = error?.status ?? 1
  console.error(`Codex could not normalize TODO.md (exit code ${exitCode}): ${error.message}`)
  process.exit(exitCode)
}
