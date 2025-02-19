import { readFileSync } from "fs";
import { resolve } from "path";
import { globSync } from "glob";
import { parse } from "yaml";
import chalk from "chalk";

// if running in github actions debug mode, do extra logging
export const verbose = !!process.env.RUNNER_DEBUG;

// get full list of redirects
export function getList() {
  // get yaml files that match glob pattern
  const files = globSync("*.y?(a)ml", { cwd: __dirname });

  info(`Found ${files.length} list file(s)`);

  // list of redirects
  const list = [];

  // keep track of duplicate entries
  const duplicates = {};

  // go through each yaml file
  for (const file of files) {
    // load file contents
    const contents = readFileSync(resolve(__dirname, file), "utf8");

    // try to parse as yaml
    let data;
    try {
      data = parse(contents);
    } catch (e) {
      addError(`Couldn't parse ${file}. Make sure it is valid YAML.`);
      continue;
    }

    // check if top level is list
    if (!Array.isArray(data)) {
      addError(`${file} is not a list`);
      continue;
    }

    // go through each entry
    for (let index = 0; index < data.length; index++) {
      // get entry
      let entry = data[index];

      // check if dict
      if (typeof entry !== "object" || Array.isArray(entry) || entry === null) {
        addError(["Entry is not a dict", trace({ file, index, entry })]);
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

      // add to list
      list.push(entry);
    }
  }

  // check that any redirects exist
  (list.length ? info : addError)(`Found ${list.length} total entr(ies)`);

  if (verbose) {
    info("Combined list");
    debug(JSON.stringify(list));
  }

  // go through duplicates
  for (const [, entries] of Object.entries(duplicates)) {
    if (entries.length <= 1) continue;
    addError([`"from" appears ${entries.length} times`, ...entries.map(trace)]);
  }

  return list;
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
