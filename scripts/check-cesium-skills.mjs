import { readFile } from "node:fs/promises"
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url))
const projectRoot = join(scriptDirectory, "..")
const skillsRoot = join(projectRoot, ".agents", "skills")
const registryUrl = "https://registry.npmjs.org/cesium/latest"

/**
 * Parse a CesiumJS semantic version from a text value.
 *
 * @param {string} value Text containing a CesiumJS version.
 * @returns {[number, number, number] | undefined} Parsed version parts.
 */
const parseVersion = value => {
  const match = value.match(/(?:v|CesiumJS\s*)?(\d+)\.(\d+)(?:\.(\d+))?/i)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)] : undefined
}

/**
 * Compare two semantic versions.
 *
 * @param {[number, number, number]} left First version.
 * @param {[number, number, number]} right Second version.
 * @returns {number} Negative, zero, or positive comparison result.
 */
const compareVersions = (left, right) => {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

/**
 * Find the documented CesiumJS baseline in a skill document.
 *
 * @param {string} content Skill document content.
 * @returns {[number, number, number] | undefined} Documented baseline.
 */
const findBaseline = content => parseVersion(
  content.match(/(?:Version baseline|Baseline|Applies to)[^\n]*CesiumJS[^\n]*/i)?.[0] ?? "",
)

/**
 * Fetch the latest CesiumJS version from the public npm registry.
 *
 * @returns {Promise<[number, number, number]>} Latest published version.
 */
const fetchLatestVersion = async () => {
  const response = await fetch(registryUrl)
  if (!response.ok) throw new Error(`CesiumJS registry request failed with HTTP ${response.status}`)
  const metadata = await response.json()
  const version = parseVersion(metadata.version ?? "")
  if (!version) throw new Error("The CesiumJS registry response does not contain a valid version")
  return version
}

/**
 * Check all project CesiumJS skills against the latest published version.
 *
 * @returns {Promise<number>} Process exit code.
 */
const checkSkills = async () => {
  const latestVersion = await fetchLatestVersion()
  const skillNames = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name.startsWith("cesiumjs-"))
    .map(entry => entry.name)
    .sort()

  const outdated = []
  const missingBaseline = []

  for (const skillName of skillNames) {
    const skillDirectory = join(skillsRoot, skillName)
    const documentNames = (await readdir(skillDirectory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
      .map(entry => entry.name)
      .sort()

    for (const documentName of documentNames) {
      const documentPath = join(skillDirectory, documentName)
      const content = await readFile(documentPath, "utf8")
      const baseline = findBaseline(content)
      const documentLabel = `${skillName}/${documentName}`

      if (!baseline) {
        missingBaseline.push(documentLabel)
      } else if (compareVersions(baseline, latestVersion) < 0) {
        outdated.push({ documentLabel, baseline })
      }
    }
  }

  const versionLabel = latestVersion.join(".")
  console.log(`CesiumJS latest published version: ${versionLabel}`)

  if (outdated.length === 0 && missingBaseline.length === 0) {
    console.log(`All ${skillNames.length} CesiumJS skills document version ${versionLabel} or newer`)
    return 0
  }

  if (outdated.length > 0) {
    console.error("Outdated CesiumJS skills:")
    for (const { documentLabel, baseline } of outdated) {
      console.error(`- ${documentLabel}: ${baseline.join(".")}`)
    }
  }

  if (missingBaseline.length > 0) {
    console.error("CesiumJS skills without a detectable version baseline:")
    for (const skillName of missingBaseline) console.error(`- ${skillName}`)
  }

  console.error("Reference: https://cesium.com/learn/cesiumjs/ref-doc/")
  return 1
}

try {
  process.exitCode = await checkSkills()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
