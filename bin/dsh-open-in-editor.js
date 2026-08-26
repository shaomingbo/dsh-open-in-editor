#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

import {
  DEFAULT_SOURCE,
  PACKAGE_NAME,
  parseArguments,
  readProfileStatus,
  resolveProfileDirectory,
  updateProfile,
} from '../lib/installer.js'

const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

function usage() {
  return `Usage: ${PACKAGE_NAME} [install|status|uninstall] [--profile web] [--source ${DEFAULT_SOURCE}]

Installs ${PACKAGE_NAME} into a DSH profile. With no command, install is used.

Commands:
  install      Add the pinned dependency and enable its DSH bundle
  status       Show whether the dependency and bundle are configured
  uninstall    Remove the dependency and disable its DSH bundle

Options:
  --profile <name|absolute-path>  Target DSH profile (default: web)
  --source <package-source>       Override the pinned dependency source
  -h, --help                      Show this help
  -v, --version                   Show the package version`
}

function printStatus(status, profileDirectory) {
  console.log(`${PACKAGE_NAME}: ${status.state}`)
  console.log(`Profile: ${profileDirectory}`)
  console.log(`Dependency: ${status.dependency ?? 'absent'}`)
  console.log(`Bundle enabled: ${status.enabled ? 'yes' : 'no'}`)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.command === 'help') {
    console.log(usage())
    return
  }
  if (options.command === 'version') {
    console.log(metadata.version)
    return
  }

  const profileDirectory = resolveProfileDirectory(options.profile)
  if (options.command === 'status') {
    const status = await readProfileStatus(profileDirectory)
    printStatus(status, profileDirectory)
    if (status.state !== 'installed') process.exitCode = 1
    return
  }

  const result = await updateProfile({
    command: options.command,
    profileDirectory,
    source: options.source,
  })
  const action = options.command === 'install' ? 'Installed' : 'Uninstalled'
  console.log(`\n${action} ${PACKAGE_NAME} in ${profileDirectory}`)
  if (result.backupPath !== undefined) console.log(`Backup: ${result.backupPath}`)
  console.log('Restart DSH manually, then hard-refresh the existing Web page.')
}

main().catch((cause) => {
  console.error(`${PACKAGE_NAME}: ${cause instanceof Error ? cause.message : String(cause)}`)
  process.exitCode = 1
})
