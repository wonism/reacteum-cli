#!/usr/bin/env node
const path = require('path');
const fs = require('fs-extra');
const argv = require('yargs');
const execa = require('execa');
const hostedGitInfo = require('hosted-git-info');
const chalk = require('chalk');
const updateNotifier = require('update-notifier');
const pkg = require('../package.json');

const { log } = console;

const spawn = (cmd) => {
  const [file, ...args] = cmd.split(/\s+/);

  return execa(file, args, { stdio: 'inherit' });
};

const install = async (rootPath) => {
  const prevDir = process.cwd();
  log(chalk.yellow(`Installing ${chalk.underline('packages')}...`));
  process.chdir(rootPath);

  try {
    await spawn('npm i');
  } finally {
    process.chdir(prevDir);
  }
};

const clone = async ({ rootPath = process.cwd() }) => {
  const hostInfo = hostedGitInfo.fromUrl('https://github.com/wonism/reacteum');
  const type = hostInfo.getDefaultRepresentation();
  const url = type === 'sshurl'
    ? hostInfo.ssh({ noCommittish: true })
    : hostInfo.https({ noCommittish: true, noGitPlus: true });

  const branch = hostInfo.committish ? `-b ${hostInfo.committish}` : '';

  log(chalk.red(`Cloning ${chalk.underline('repository')}...`));
  await spawn(`git clone ${branch} ${url} ${rootPath} --single-branch`);

  const gitInfos = path.resolve(rootPath, '.git');

  await fs.remove(path.join(rootPath, '.git'));

  await install(rootPath);
};

const develop = async () => {
  log(chalk.green(`Running ${chalk.underline('webpack dev server')}...`));
  process.env.NODE_ENV = 'development';
  await spawn('./node_modules/.bin/webpack-dev-server --config config/webpack.config.dev.js --hot --host 0.0.0.0');
};

const bundle = async () => {
  log(chalk.cyan(`Bundling ${chalk.underline('react application')}...`));
  process.env.NODE_ENV = 'production';
  await spawn('./node_modules/.bin/webpack -p --config config/webpack.config.prod.js');
};

const serve = async () => {
  await spawn('reacteum bundle');
  log(chalk.blue(`RUnning ${chalk.underline('express server')}...`));
  process.env.NODE_ENV = 'development';
  await spawn('./node_modules/.bin/nodemon server --exec babel-node');
};

const transpile = async () => {
  await spawn('reacteum bundle');
  log(chalk.purple(`Transpiling ${chalk.underline('express server')}...`));
  process.env.NODE_ENV = 'production';
  await spawn('./node_modules/.bin/webpack -p --config config/webpack.config.server.js');
};

const notifier = updateNotifier({ pkg });
notifier.notify();

argv
  .version(pkg.version)
  .usage('Usage: $0 <command> [options] \ne.g $0 new my-project')
  .command(['new [rootPath]', 'n'], 'Create new project', {}, clone)
  .example('$0 new my-project', 'Create `my-project` directory')
  .command(['develop', 'dev', 'd'], 'Dev server with Webpack', {}, develop)
  .command(['bundle', 'b'], 'Bundle React app', {}, bundle)
  .command(['serve', 's'], 'Dev server with Express', {}, serve)
  .command(['transpile', 't'], 'Transpile server and client', {}, transpile)
  .demandCommand(1, 'Pass --help to see all available commands and options')
  .alias('v', 'version')
  .alias('h', 'help')
  .epilog('Written by wonism https://wonism.github.io')
  .argv;
