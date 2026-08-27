# LGS1920 Deployment Script

## Overview

The `deploy.js` entry point invokes `deployment/Deployment.js` to automate releases of an LGS1920 product to the
`production`, `staging`, or `test` platform. The product is inferred from the name of the current working directory
(`studio` or `backend`).

The deployment is executed with Bun. It builds the product, prepares a versioned release archive, transfers the
archive to the configured server over SSH/SCP, activates the release through a stable `current` symbolic link, and
pushes a deployment tag when every step succeeds.

The deployment implementation is located in:

- `deploy.js`: command-line entry point and platform selection.
- `deployment/Deployment.js`: deployment lifecycle, build, archive, SSH, and Git operations.
- `deployment/DeploymentCommands.js`: backend environment validation and safe remote PM2 command generation.
- `deployment/deploy.yml`: product, platform, local, and remote configuration.

### Key Features

- **Build Automation**: Builds the application using Bun (`bun run build` for `studio`, `bun build.js` for `backend`
  with optional minification for `production`).
- **File Preparation**: Copies configuration files (e.g., PM2 config for `backend`), updates service worker and manifest
  for `studio`, and creates a zip archive of the build.
- **Remote Deployment**: Transfers the zip file to a remote server using SCP, unzips it, and creates a symbolic link for
  consistent access.
- **Git Tag Management**: Creates a Git tag locally (format: `<platform>-<version>-<branch>-<date>`), pushes it to the
  remote repository on successful deployment, and deletes it if the deployment fails.
- **PM2 Integration**: Restarts the `backend` application using PM2 with platform-specific configurations.
- **Backend error log rotation**: Sends backend standard output to `/dev/null`, keeps backend errors in the
  platform-specific shared log directory, and installs/configures `pm2-logrotate` during backend deployment.
- **Backend watchdog**: Installs a user-level five-minute liveness watchdog and an `@reboot` PM2 startup entry for
  backend deployments without requiring `sudo`.
- **Backend environment loading**: Uploads the local `../backend/.env` to the platform backend shared directory,
  regenerates `LGS1920_CONTACT_CSRF_SECRET` in the transferred content, enforces directory mode `700` and file mode
  `600`, then loads it before starting PM2 with `--update-env`. SMTP variables are never added to Studio builds or
  release archives.
- **Error Handling**: Logs errors with color-coded console output (red for errors, green for success, yellow for
  emphasis) and ensures cleanup of Git tags on failure.

## Prerequisites

Before running the script, ensure the following are installed and configured:

- **Bun**: Required to run the deployment script and build the applications.
- **Git**: Required for version control and tag management.
- **SSH and SCP**: Required for remote server access and file transfer. The script invokes `sshpass` for SCP.
- **Node Modules**:
    - `argparse`: For command-line argument parsing in `deploy.js`.
    - `node:child_process`: Built-in module for process execution.
    - `node:path`: Built-in module for path manipulation.
    - `simple-git`: For Git operations.
    - `ssh2`: For SSH connections.
    - `zip-a-folder`: For zipping the build.
    - `node:fs`: Built-in module for file system operations.
    - `yaml`: For parsing the `deploy.yml` configuration file.
- **Environment Variables**:
    - `LGS1920_PASSWORD_PRODUCTION`, `LGS1920_PASSWORD_STAGING`, or `LGS1920_PASSWORD_TEST`: Password for SSH
      authentication to the respective platform (user: `p5077` on `p5077.phpnet.org`).
    - `LGS1920_GITHUB_TOKEN`: GitHub token for Git authentication.
    - `LGS1920_GITHUB_USER`: GitHub username for Git operations.
- **Backend local environment**: A readable `../backend/.env` file is required for a backend deployment. It is
  transferred through the authenticated SSH/SFTP connection to `shared/backend.env`; its contents are never logged.
  Values containing shell metacharacters must be quoted; invalid assignments are rejected before transfer.
- **Configuration File**: A `deploy.yml` file in the `deployment/` directory, specifying remote server details, paths,
  and PM2 settings.
- **PM2**: Required on the remote server (`/home/.bun/bin/pm2`) for `backend` deployments.
- **PM2 log rotation**: The backend deployment user must be allowed to install PM2 modules with `pm2 install`.
- **User crontab**: The backend deployment user must be allowed to manage its own crontab with `crontab`.

Dependencies are declared in `package.json` and should be installed with the project's package manager before
deployment.

## Configuration

The script relies on a `deploy.yml` file located in the `deployment/` directory. This file defines configurations for:

- **Backend**: Settings for each platform (`production`, `staging`, `test`):
    - Server name (e.g., `LGS1920 Backend server`).
    - Domain (e.g., `api.lgs1920.fr`).
    - Port (e.g., 3333 for `production`, 3334 for `staging`, 3335 for `test`).
    - PM2 configuration (e.g., `backend-production.config.js`).
    - Backend-only environment file relative to the platform backend directory (for example,
      `shared/backend.env`).
- **Studio**: Settings for each platform:
    - Domain (e.g., `studio.lgs1920.fr` for `production`, `staging.lgs1920.fr` for `staging`).
    - Proxy settings (e.g., `/proxy.php?csurl=`).
- **Site**: Domain and protocol settings (e.g., `lgs1920.fr`, `https`).
- **Local**: The local distribution directory (`dist`) where builds are stored.
- **Remote**: Server details:
    - User: `p5077`.
    - Host: `p5077.phpnet.org`.
    - Path: `/home/www/lgs1920`.
    - Release directories: `releases` for builds, `current` for the active symbolic link.

Ensure the `deploy.yml` file is present and correctly formatted before running the script.

## Usage

The `deploy.js` script is executed using Bun’s `run` command. The product (`studio` or `backend`) is inferred from the
current working directory’s name, and the local workspace path is set to its parent directory.

### Command-Line Flags

- `-p, --prod`: Deploy to the `production` platform.
- `-s, --staging`: Deploy to the `staging` platform.
- `-t, --test`: Deploy to the `test` platform.

The script resolves the target platform in this order:

- `--prod` / `-p` selects `production`.
- Otherwise, `--staging` / `-s` selects `staging`.
- Otherwise, `--test` / `-t`, or no platform flag, selects `test`.

The script infers:
- `product`: From the current directory name (e.g., `studio` if run from `/home/christian/devs/assets/lgs1920/studio`).
- `local`: From the parent directory of the current working directory (e.g., `/home/christian/devs/assets/lgs1920`).

### General Syntax

```bash
bun run deploy [-p | --prod | -s | --staging | -t | --test]
```

### Examples

Run these commands from the appropriate product directory (`studio` or `backend`). The current working directory
determines the `product`.

1. **Deploy the `studio` product to the `staging` platform**:
   ```bash
   cd /home/christian/devs/assets/lgs1920/studio
   bun run deploy -s
   ```
   Builds the `studio` application, zips it, transfers it to `p5077.phpnet.org:/home/www/lgs1920/staging/studio/releases`,
   deploys it, and pushes a Git tag (e.g., `staging-1.0.0-main-20251009185822`) on success.

2. **Deploy the `backend` product to the `production` platform**:
   ```bash
   cd /home/christian/devs/assets/lgs1920/backend
   chmod 600 .env
   bun run deploy -p
   ```
   Builds the `backend` application (with minification), zips it, transfers it to
   `p5077.phpnet.org:/home/www/lgs1920/production/backend/releases`, deploys it, restarts the application with PM2 using
   `backend-production.config.js` on port 3333, and pushes a Git tag on success. Before PM2 starts, the local `.env`
   is uploaded to `/home/www/lgs1920/production/backend/shared/backend.env` with restrictive permissions.

3. **Deploy the `backend` product to the `test` platform**:
   ```bash
   cd /home/christian/devs/assets/lgs1920/backend
   chmod 600 .env
   bun run deploy -t
   ```
   Similar to the production example, but targets the test server with port 3335 and `backend-test.config.js`.

4. **Deploy the `studio` product to the `production` platform**:
   ```bash
   cd /home/christian/devs/assets/lgs1920/studio
   bun run deploy -p
   ```
   Deploys the `studio` application to `p5077.phpnet.org:/home/www/lgs1920/production/studio/releases` without PM2
   restart.

### Parameter Notes

- **Platform**: One of `production`, `staging`, or `test`, selected via `-p/--prod`, `-s/--staging`, or `-t/--test`.
- **Product**: Automatically set to the current directory name (`studio` or `backend`). Run the command from the
  appropriate directory.
- **Local Path**: Automatically set to the parent directory of the current working directory (e.g.,
  `/home/christian/devs/assets/lgs1920`).
- Ensure the current directory is either `studio` or `backend` when running the command.

## Deployment Process

The script follows these steps:

1. **Configuration**: Loads `deploy.yml`, initializes Git (with GitHub token) and SSH configurations (user: `p5077`,
   host: `p5077.phpnet.org`), and retrieves the current branch and version from `version.json` (for `backend`) or
   `public/version.json` (for `studio`).
2. **Build**: Builds the application using Bun (`bun run build` for `studio`, `bun build.js` with optional `-m` for
   `backend` in `production`). Stores the build in `dist/<version>`.
3. **Pre-Deployment**:
    - Creates a local Git tag (e.g., `staging-1.0.0-main-20251009185822`).
    - For `studio`: Updates `service-worker-pwa.js` (replaces `__BUILD_TIME__`, `__VERSION__`, `__BRANCH__`) and
      `manifest.webmanifest` (adjusts app name based on platform).
    - For `backend`: Copies PM2 configuration and renames `index.js` to `backend.js`.
    - Saves branch info (`branch.json`), server config (`servers.json`), and build date (`build.json`).
    - Zips the build to `dist/<version>.zip`.
4. **Copy**: Transfers the zip file to the remote server’s `releases` directory (e.g.,
   `/home/www/lgs1920/<platform>/<product>/releases`) using SCP.
5. **Unzip**: Unzips the file on the remote server via SSH to `<platform>/<product>/releases/<version>`.
6. **Link**: Creates a symbolic link from `<platform>/<product>/current` to the new release and removes the zip file.
7. **Backend environment transfer**: For `backend`, creates the remote shared directory with mode `700`, regenerates
   `LGS1920_CONTACT_CSRF_SECRET`, uploads the resulting environment content to the configured environment path, and
   applies mode `600`. The file stays outside the release tree.
8. **Post-Deployment**: For `backend`, sources the shared environment file and starts or restarts the application
   using PM2 with `--update-env` and the platform-specific config (e.g., `backend-production.config.js`). The same
   backend-only command creates `shared/logs`, installs `pm2-logrotate` if needed, and configures 10 MB rotation,
   fourteen retained archives, gzip compression, and timestamped rotated filenames. It also installs an idempotent
   user-level crontab block with a five-minute `/ping` watchdog and an `@reboot` startup command. Studio deployments
   do not execute the backend PM2 command.
9. **Tag Push**: Pushes the Git tag and branch to the remote repository (`origin`) if all steps succeed.
10. **Error Handling**: Deletes the Git tag locally and remotely if any step fails, logging errors with color-coded
   output (red for errors, green for success, yellow for emphasis). The CLI exits with status `0` on success and
   status `1` on failure.

## Troubleshooting

- **Error: Invalid platform**:
  Ensure exactly one platform flag (`-p/--prod`, `-s/--staging`, or `-t/--test`) is provided.

- **Error: Invalid product**:
  Verify you are running the command from the `studio` or `backend` directory. The directory name must match the
  product.

- **Error: Missing environment variables**:
  Set the required environment variables:
  ```bash
  export LGS1920_PASSWORD_STAGING="your_password"
  export LGS1920_GITHUB_TOKEN="your_token"
  export LGS1920_GITHUB_USER="your_username"
  ```

- **Error: deploy.yml not found or invalid**:
  Verify that `deployment/deploy.yml` exists in the project directory and matches the expected structure.

- **Error: SSH connection failed**:
  Check the SSH credentials (`p5077`, password from environment variable) and ensure `p5077.phpnet.org` is accessible.

- **Error: Git push failed**:
  Verify the GitHub token and user credentials, and ensure the repository remote (`origin`) is correctly set.

- **Error: PM2 restart failed**:
  Ensure PM2 is installed on the remote server at `/home/.bun/bin/pm2` and the config file (e.g.,
  `backend-staging.config.js`) exists in `deployment/pm2-config/`.

- **Error: Backend environment file missing or unreadable**:
  Create `../backend/.env` locally, keep it outside Git, and run `chmod 600 ../backend/.env` before the backend
  deployment. The deployment refuses to start PM2 without a readable environment file.

- **Error: manifest.webmanifest not found**:
  For `studio` deployments, ensure `manifest.webmanifest` exists in the build output (`dist/<version>`).

## License

Copyright © 2025 LGS1920. All rights reserved.
