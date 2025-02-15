import color from 'kleur';
import fs from 'fs';
import ora from 'ora';
import os from 'os';
import path from 'path';
import spawn from 'cross-spawn';
import type { ChildProcess } from 'child_process';
import type { IntegrationData } from '../types';

export function installDeps(pkgManager: string, dir: string) {
  let installChild: ChildProcess;

  const install = new Promise<void>((resolve) => {
    try {
      installChild = spawn(pkgManager, ['install'], {
        cwd: dir,
        stdio: 'ignore',
      });

      installChild.on('error', () => {
        resolve();
      });

      installChild.on('close', () => {
        resolve();
      });
    } catch (e) {
      //
    }
  });

  const abort = async () => {
    if (installChild) {
      installChild.kill('SIGINT');
    }
  };

  return { abort, install };
}

export function startSpinner(msg: string) {
  const spinner = ora(msg).start();
  return spinner;
}

export function backgroundInstallDeps(pkgManager: string, baseApp: IntegrationData) {
  const { tmpInstallDir } = setupTmpInstall(baseApp);

  const { install, abort } = installDeps(pkgManager, tmpInstallDir);

  const complete = async (runInstall: boolean, outDir: string) => {
    let success = false;

    if (runInstall) {
      const spinner = startSpinner(`Installing ${pkgManager} dependencies...`);
      try {
        await install;

        const tmpNodeModules = path.join(tmpInstallDir, 'node_modules');
        const appNodeModules = path.join(outDir, 'node_modules');
        await fs.promises.rename(tmpNodeModules, appNodeModules);

        try {
          await fs.promises.rename(
            path.join(tmpInstallDir, 'package-lock.json'),
            path.join(outDir, 'package-lock.json')
          );
        } catch (e) {
          //
        }
        try {
          await fs.promises.rename(
            path.join(tmpInstallDir, 'yarn.lock'),
            path.join(outDir, 'yarn.lock')
          );
        } catch (e) {
          //
        }

        spinner.succeed();
        success = true;
      } catch (e) {
        spinner.fail();
      }
    } else {
      await abort();
    }

    return success;
  };

  return { abort, complete };
}

function setupTmpInstall(baseApp: IntegrationData) {
  const tmpId =
    'create-qwik-' +
    Math.round(Math.random() * Number.MAX_SAFE_INTEGER)
      .toString(36)
      .toLowerCase();
  const tmpInstallDir = path.join(os.tmpdir(), tmpId);

  try {
    fs.mkdirSync(tmpInstallDir);
  } catch (e) {
    console.error(`\n❌ ${color.red(String(e))}\n`);
  }

  const basePkgJson = path.join(baseApp.dir, 'package.json');
  const tmpPkgJson = path.join(tmpInstallDir, 'package.json');
  fs.copyFileSync(basePkgJson, tmpPkgJson);

  return { tmpInstallDir };
}
