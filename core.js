import { readFileSync } from "fs";
import { resolve } from "path";
import { globSync } from "glob";
import { parse } from "yaml";
import chalk from "chalk";

// if running in github actions debug mode, do extra logging
export const verbose = !!process.env.RUNNER_DEBUG;

// get lists of redirects
export function getLists() {
  // get yaml files that match glob pattern
  const files = globSync("*.y?(a)ml", { cwd: __dirname });

  info(`Found ${files.length} list file(s)`);

  // lists of redirects
  const lists = {};

  // keep track of duplicate entries
  const duplicates = {};

  // go through each yaml file
  for (const file of files) {
    debug("  " + file);

    // load file contents
    const contents = readFileSync(resolve(__dirname, file), "utf8");

    // try to parse as yaml
    let data;
    try {
      data = parse(contents);
    } catch (e) {
      addError("Couldn't parse file. Make sure it is valid YAML.");
      continue;
    }

    // check if top level is list
    if (!Array.isArray(data)) {
      addError("File is not a list");
      continue;
    }

    // go through each entry
    for (let index = 0; index < data.length; index++) {
      // get entry
      let entry = data[index];

      // check if dict
      if (typeof entry !== "object" || Array.isArray(entry) || entry === null) {
        addError(["Entry is not a dict", JSON.stringify(entry)]);
        continue;
      }

      // add metadata
      entry.file = file;
      entry.index = index;

      const { from, to } = entry;

      // check "from" field
      if (!(typeof from === "string" && from.trim())) {
        addError([
          `"from" field ${from === undefined ? "missing" : "invalid"}`,
          trace(entry),
        ]);
        continue;
      }

      // normalize "from" field. lower case, remove leading slashes.
      entry.from = from.toLowerCase().replace(/^(\/+)/, "");

      // add to duplicate list
      duplicates[from] ??= [];
      duplicates[from].push(entry);

      // check "to" field
      if (!(typeof to === "string" && to.trim())) {
        addError([
          `"to" field ${to === undefined ? "missing" : "invalid"}`,
          trace(entry),
        ]);
        continue;
      }

      // add to lists
      lists[file] ??= [];
      lists[file].push(entry);
    }
  }

  // total count of redirect entries
  const count = Object.values(lists).flat().length;

  // check that any redirects exist
  (count ? info : addError)(`Found ${count} total entr(ies)`);

  if (verbose) {
    info("Combined list");
    debug(JSON.stringify(lists));
  }

  // go through duplicates
  for (const [, entries] of Object.entries(duplicates)) {
    if (entries.length <= 1) continue;
    addError([`"from" appears ${entries.length} times`, ...entries.map(trace)]);
  }

  return lists;
}

// when script finished, report all errors together
export function onExit() {
  process.on("exit", () => {
    if (errors.length) {
      critical(`${errors.length} error(s) occurred:`);
      for (const [firstLine, ...lines] of errors) {
        error(firstLine);
        for (const line of lines) debug("  " + line);
      }
      process.exit(1);
    } else {
      success("Done");
      process.exitCode = 0;
    }
  });
}

// track errors
let errors = [];
export function addError(value) {
  errors.push([value].flat());
}

// colored logs
export function info(message) {
  console.log(chalk.cyan(message));
}
export function debug(message) {
  console.log(chalk.gray(message));
}
export function warning(message) {
  console.log(chalk.yellow(message));
}
export function error(message) {
  console.log(chalk.red(message));
}
export function success(message) {
  console.log(chalk.bgGreen(message));
}
export function critical(message) {
  console.log(chalk.bgRed(message));
}

// log info for identifying bad entries
export function trace({ file, index, ...entry }) {
  return `${file} entry #${index + 1} ${JSON.stringify(entry)}`;
}
