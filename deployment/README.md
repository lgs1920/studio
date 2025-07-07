# LGS1920 Deployment Script

## Overview

The `Deployment.js` script, invoked via `deploy.js`, is a Node.js module designed to automate the deployment of the
LGS1920 project applications (`studio` or `backend`) to various platforms (`production`, `staging`, or `test`). It
handles building, zipping, transferring, and deploying the application to a remote server via SSH, along with Git tag
management to track deployments. The scripts are part of the `LGS1920/backend` project, located at
`/home/christian/devs/assets/lgs1920/backend/deployment/Deployment.js` and
`/home/christian/devs/assets/lgs1920/backend/deploy.js`.

### Key Features

- **Build Automation**: Builds the application using Bun (`bun run build` for `studio`, `bun build.js` for `backend`
  with optional minification for `production`).
- **File Preparation**: Copies configuration files (e.g., PM2 config for `backend`) and creates a zip archive of the
  build.
- **Remote Deployment**: Transfers the zip file to a remote server using SCP, unzips it, and creates a symbolic link for
  consistent access.
- **Git Tag Management**: Creates a Git tag locally (format: `<platform>-<version>-<branch>-<date>`), pushes it to the
  remote repository only on successful deployment, and deletes it if the deployment fails.
- **PM2 Integration**: Restarts the `backend` application using PM2 with platform-specific configurations.
- **Error Handling**: Logs errors with color-coded console output and ensures cleanup of Git tags on failure.

## Prerequisites

Before running the script, ensure the following are installed and configured:

- **Node.js**: Required for running the script.
- **Bun**: Used for building and running the application (e.g., `bun run build`, `bun build.js`).
- **Git**: Required for version control and tag management.
- **SSH and SCP**: Required for remote server access and file transfer.
- **Node Modules**:
    - `argparse` (for command-line argument parsing in `deploy.js`)
    - `child_process` (built-in)
    - `path` (built-in)
    - `scp2` (for SCP file transfers)
    - `simple-git` (for Git operations)
    - `ssh2` (for SSH connections)
    - `zip-a-folder` (for zipping the build)
    - `fs` (built-in, via `require`)
    - `yaml` (for parsing the `deploy.yml` configuration file)
- **Environment Variables**:
    - `LGS1920_PASSWORD_PRODUCTION`, `LGS1920_PASSWORD_STAGING`, or `LGS1920_PASSWORD_TEST`: Password for SSH
      authentication to the respective platform (user: `p5077` on `p5077.webmo.fr`).
    - `LGS1920_GITHUB_TOKEN`: GitHub token for Git authentication.
    - `LGS1920_GITHUB_USER`: GitHub username for Git operations.
- **Configuration File**: A `deploy.yml` file in the `deployment/` directory, specifying remote server details, paths,
  and PM2 settings.
- **PM2**: Required on the remote server (`/home/.bun/bin/pm2`) for `backend` deployments.

Install dependencies using:

```bash
npm install argparse scp2 simple-git ssh2 zip-a-folder yaml
```

## Configuration

The script relies on a `deploy.yml` file located in the `deployment/` directory. This file defines configurations for:

- **Backend**: Settings for each platform (`production`, `staging`, `test`), including:
    - Server name (e.g., `LGS1920 Backend server`).
    - Domain (e.g., `api.lgs1920.fr`).
    - Port (e.g., 3333 for `production`, 3334 for `staging`, 3335 for `test`).
    - PM2 configuration (e.g., `backend-production.config.js`).
- **Studio**: Settings for each platform, including:
    - Domain (e.g., `studio.lgs1920.fr` for `production`, `staging.lgs1920.fr` for `staging`).
    - Proxy settings (e.g., `/proxy.php?csurl=`).
- **Site**: Domain and protocol settings (e.g., `lgs1920.fr`, `https`).
- **Local**: The local distribution directory (`dist`) where builds are stored.
- **Remote**: Server details:
    - User: `p5077`
    - Host: `p5077.webmo.fr`
    - Path: `/home/www/lgs1920`
    - Release directories: `releases` for builds, `current` for the active symbolic link.

Ensure the `deploy.yml` file is present and correctly formatted before running the script.

## Usage

The `deploy.js` script is executed using Bun’s `run` command and requires a single platform flag to specify the target
platform (`production`, `staging`, or `test`). The product (`studio` or `backend`) is automatically determined from the
current working directory’s name, and the local path is set to the parent directory of the current working directory.

### Command-Line Flags

- `-p, --prod`: Deploy to the `production` platform.
- `-s, --staging`: Deploy to the `staging` platform.
- `-t, --test`: Deploy to the `test` platform.

**Note**: Exactly one platform flag must be provided. The script infers:

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
   Builds the `studio` application, zips it, transfers it to `p5077.webmo.fr:/home/www/lgs1920/staging/studio/releases`,
   deploys it, and pushes a Git tag (e.g., `staging-1.0.0-main-20250707180615`) on success.

2. **Deploy the `backend` product to the `production` platform**:
   ```bash
   cd /home/christian/devs/assets/lgs1920/backend
   bun run deploy -p
   ```
   Builds the `backend` application (with minification), zips it, transfers it to
   `p5077.webmo.fr:/home/www/lgs1920/production/backend/releases`, deploys it, restarts the application with PM2 using
   `backend-production.config.js` on port 3333, and pushes a Git tag on success.

3. **Deploy the `backend` product to the `test` platform**:
   ```bash
   cd /home/christian/devs/assets/lgs1920/backend
   bun run deploy -t
   ```
   Similar to the production example, but targets the test server with port 3335 and `backend-test.config.js`.

4. **Deploy the `studio` product to the `production` platform**:
   ```bash
   cd /home/christian/devs/assets/lgs1920/studio
   bun run deploy -p
   ```
   Deploys the `studio` application to `p5077.webmo.fr:/home/www/lgs1920/production/studio/releases` without PM2
   restart.

### Parameter Notes

- **Platform**: Must be one of `production`, `staging`, or `test`, specified via `-p/--prod`, `-s/--staging`, or
  `-t/--test`. Only one flag can be used at a time.
- **Product**: Automatically set to the current directory name (`studio` or `backend`). Run the command from the
  appropriate directory.
- **Local Path**: Automatically set to the parent directory of the current working directory (e.g.,
  `/home/christian/devs/assets/lgs1920`).
- Ensure the current directory is either `studio` or `backend` when running the command.

## Deployment Process

The script follows these steps:

1. **Configuration**: Loads `deploy.yml`, initializes Git (with GitHub token) and SSH configurations (user: `p5077`,
   host: `p5077.webmo.fr`), and retrieves the current branch and version from `version.json` (for `backend`) or
   `public/version.json` (for `studio`).
2. **Build**: Builds the application using Bun (`bun run build` for `studio`, `bun build.js` with optional `-m` for
   `backend` in `production`).
3. **Pre-Deployment**: Creates a local Git tag (e.g., `staging-1.0.0-main-20250707180615`), copies configuration files (
   e.g., PM2 config for `backend`), and zips the build to `dist/<version>.zip`.
4. **Copy**: Transfers the zip file to the remote server’s `releases` directory (e.g.,
   `/home/www/lgs1920/<platform>/<product>/releases`) using SCP.
5. **Unzip**: Unzips the file on the remote server via SSH to `<platform>/<product>/releases/<version>`.
6. **Link**: Creates a symbolic link from `<platform>/<product>/current` to the new release and removes the zip file.
7. **Post-Deployment**: For `backend`, restarts the application using PM2 with the platform-specific config (e.g.,
   `backend-production.config.js`).
8. **Tag Push**: Pushes the Git tag and branch to the remote repository (`origin`) if all steps succeed.
9. **Error Handling**: Deletes the Git tag locally and remotely if any step fails, logging errors with color-coded
   output.

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
  Check the SSH credentials (`p5077`, password from environment variable) and ensure `p5077.webmo.fr` is accessible.

- **Error: Git push failed**:
  Verify the GitHub token and user credentials, and ensure the repository remote (`origin`) is correctly set.

- **Error: PM2 restart failed**:
  Ensure PM2 is installed on the remote server at `/home/.bun/bin/pm2` and the config file (e.g.,
  `backend-staging.config.js`) exists in `deployment/pm2-config/`.

## License

Copyright © 2024 LGS1920. All rights reserved.