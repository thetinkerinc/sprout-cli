import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { search, confirm } from "@inquirer/prompts";

import type { Dirent } from "node:fs";

export type PathType = "file" | "directory" | null;

export interface PathSuggestion {
	name: string;
	value: string;
	isDirectory?: boolean;
	isFile?: boolean;
	isParent?: boolean;
}

export interface PromptForPathOptions {
	message?: string;
	cwd?: string;
	pathType?: PathType;
	caseInsensitive?: boolean;
	allowNew?: boolean;
	confirmNew?: boolean;
	filter?: (
		item: PathSuggestion
	) => boolean | Promise<boolean>;
	navigateDirectories?: boolean;
}

export async function filePrompt(
	options: PromptForPathOptions = {}
): Promise<string> {
	const {
		message = "Select a path",
		cwd = process.cwd(),
		pathType = null,
		caseInsensitive = true,
		allowNew = true,
		confirmNew = true,
		navigateDirectories = true,
		filter
	} = options;

	let currentDir = path.resolve(cwd);

	const getSuggestions = async (
		input = ""
	): Promise<PathSuggestion[]> => {
		const resolved = normalizeInput(currentDir, input);

		let partial = "";

		try {
			const stat = await fs.stat(resolved);

			if (!stat.isDirectory()) {
				partial = path.basename(resolved);
			}
		} catch {
			partial = path.basename(resolved);
		}

		let entries: Dirent<string>[] = [];

		try {
			entries = await fs.readdir(currentDir, {
				withFileTypes: true,
				encoding: "utf8"
			});
		} catch {
			entries = [];
		}

		let results: PathSuggestion[] = [];

		if (pathType !== "file") {
			results.push({
				name: `./ ${gray("Select current directory")}`,
				value: currentDir,
				isDirectory: true
			});
		}

		results.push({
			name: `../ ${gray("Navigate to parent directory")}`,
			value: path.dirname(currentDir),
			isDirectory: true,
			isParent: true
		});

		for (const entry of entries) {
			const fullPath = path.join(
				currentDir,
				entry.name
			);

			results.push({
				name:
					entry.name +
					(entry.isDirectory() ? "/" : ""),
				value: fullPath,
				isDirectory: entry.isDirectory(),
				isFile: entry.isFile()
			});
		}

		if (pathType === "directory") {
			results = results.filter(
				(item) =>
					item.isParent ||
					item.isDirectory === true
			);
		}

		if (partial) {
			const needle = caseInsensitive
				? partial.toLowerCase()
				: partial;

			results = results.filter((item) => {
				if (item.isParent) return true;

				if (
					item.isDirectory &&
					item.value === currentDir
				) {
					return true;
				}

				const basename = caseInsensitive
					? path.basename(item.value).toLowerCase()
					: path.basename(item.value);

				return basename.includes(needle);
			});
		}

		if (filter) {
			const filtered: PathSuggestion[] = [];

			for (const item of results) {
				if (await filter(item)) {
					filtered.push(item);
				}
			}

			results = filtered;
		}

		if (allowNew && input.trim()) {
			results.unshift({
				name: `${input} ${gray("(new path)")}`,
				value: normalizeInput(currentDir, input)
			});
		}

		return results;
	};

	while (true) {
		const selected = await search<string>(
			{
				message: `${message} (${formatDisplayPath(
					currentDir
				)})`,
				source: getSuggestions
			},
			{
				clearPromptOnDone: true
			}
		);

		const selectedPath = path.resolve(selected);

		let stat: Awaited<
			ReturnType<typeof fs.stat>
		> | null = null;

		try {
			stat = await fs.stat(selectedPath);
		} catch {}

		if (
			pathType !== "file" &&
			selectedPath === currentDir
		) {
			return selectedPath;
		}

		if (
			selectedPath === path.dirname(currentDir)
		) {
			currentDir = selectedPath;
			continue;
		}

		if (
			navigateDirectories &&
			stat?.isDirectory()
		) {
			currentDir = selectedPath;
			continue;
		}

		if (stat) {
			return selectedPath;
		}

		if (!allowNew) {
			throw new Error(
				`Path does not exist: ${selectedPath}`
			);
		}

		if (confirmNew) {
			const approved = await confirm({
				message: `Use non-existing path?\n${selectedPath}`
			});

			if (!approved) {
				continue;
			}
		}

		return selectedPath;
	}
}

function formatDisplayPath(dir: string) {
	return path.resolve(dir).replace(os.homedir(), '~');
}

function normalizeInput(currentDir: string, input: string = '') {
	let normalized = input.trim();

	if (!normalized) {
		return currentDir;
	}

	const homeRegExp = new RegExp(`^~\$|~${path.sep}`, 'g');
	normalized = path.normalize(normalized.replace(homeRegExp, os.homedir() + path.sep));

	if (!path.isAbsolute(normalized)) {
		normalized = path.resolve(currentDir, normalized);
	}

	return normalized;
}

function gray(txt: string) {
	return `\x1b[90m${txt}\x1b[0m`;
}
