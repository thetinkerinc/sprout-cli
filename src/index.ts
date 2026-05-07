#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { program } from 'commander';
import { input } from '@inquirer/prompts';
import shell from 'shelljs';
import exec from 'shelljs-live';
import * as _ from 'radashi';

import { filePrompt } from './file-prompt';
import { env } from './env';

program
	.name('sprout cli')
	.description('The official CLI for managing sprout projects');

program
	.command('init')
	.action(async () => {
		const dir = await getProjectDir();
		const name = await getProjectName(path.basename(dir));
		const slug = _.dash(name);

		shell.cd(dir);
		exec('git clone --depth 1 https://github.com/thetinkerinc/sprout-template.git ./');
		shell.rm('-rf', '.git');
		shell.sed('-i', '<<sprout-app>>', slug, 'package.json', 'wrangler.jsonc');
		fs.writeFileSync(path.resolve(dir, '.env'), env);
		exec('bun install');

		console.log('next steps');
		console.log(`cd ${dir}`);
		console.log('bun run dev');

		//clone template
		//replace strings with name
		//make .env
		//init components (wrangler, trigger)
		//print next steps
		//- set up clerk
		//- add api keys to .env and wrangler.jsonc
	});

async function getProjectDir() {
	const dir = await filePrompt({
		message: 'Which directory will your project live in?',
		pathType: 'directory',
		allowNew: true,
		confirmNew: true
	});

	verifyDirectory(dir);

	return dir;
}

async function getProjectName(dir: string) {
	const name = await input({
		message: 'What is the name of your project?',
		default: dir,
		prefill: 'editable',
		validate: (n) => {
			if (!n || n.length === 0) {
				return 'Please choose a name for your project';
			}
			return true;
		}
	});

	return name;
}

function verifyDirectory(dir: string) {
	if (dir !== '.') {
		shell.mkdir('-p', dir);
	}
	const contents = shell.ls('-A', dir);
	if (contents.length > 0) {
		console.log(`Cannot initialize a sprout project in ${dir} because it is not empty`);
		process.exit(0);
	}
}

program.parse();
