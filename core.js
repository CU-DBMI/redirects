import { readFileSync } from "fs";
import { resolve } from "path";
import { globSync } from "glob";
import { parse } from "yaml";

// collect (caught) errors to report at end
const errors = [];

// if running in github actions debug mode, do extra logging
export const verbose = !!process.env.RUNNER_DEBUG;

// get yaml files that match glob pattern
const files = globSync("*.y?(a)ml", { cwd: __dirname });

log("Files", files.join(" "));

// start combined list of redirects
export const list = [];

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
  } catch (error) {
    addError(`Couldn't parse ${file}. Make sure it is valid YAML.`);
    continue;
  }

  // check if top level is list
  if (!Array.isArray(data)) {
    addError(`${file} is not a list`);
    continue;
  }

  // go through each entry
  for (let [index, entry] of Object.entries(data)) {
    index = Number(index) + 1;
    const trace = `${file} entry ${index}`;

    // check if dict
    if (typeof entry !== "object") {
      addError(`${trace} is not a dict`);
      continue;
    }

    // check "from" field
    if (!(typeof entry.from === "string" && entry.from.trim())) {
      addError(`${trace} "from" field invalid`);
      continue;
    }

    // check "to" field
    if (!(typeof entry.to === "string" && entry.to.trim()))
      addError(`${trace} "to" field invalid`);

    // normalize "from" field. lower case, remove leading slashes.
    entry.from = entry.from.toLowerCase().replace(/^(\/+)/, "");

    // add to combined list
    list.push(entry);

    // add to duplicate list. record source file and entry number for logging.
    duplicates[entry.from] ??= [];
    duplicates[entry.from].push({ ...entry, file, index });
  }
}

// check that any redirects exist
if (!list.length) addError("No redirects");

if (verbose) log("Combined redirects list", list);

// trigger errors for duplicates
for (const [from, entries] of Object.entries(duplicates)) {
  const count = entries.length;
  if (count <= 1) continue;
  const duplicates = entries
    .map(({ file, index }) => `\n    ${file} entry ${index}`)
    .join("");
  addError(`"from: ${from}" appears ${count} time(s): ${duplicates}`);
}

// add error
export function addError(error) {
  errors.push(error);
}

// when script finished
process.on("exit", () => {
  // report all errors together
  if (errors.length) {
    process.exitCode = 1;
    errors.forEach(logError);
    logError(`${errors.length} error(s)`);
  } else {
    process.exitCode = 0;
    log("No errors!");
  }
});

// formatted normal log
export function log(message, data) {
  console.info("\x1b[1m\x1b[96m" + message + "\x1b[0m");
  if (data) console.log(data);
}

// formatted error log
export function logError(message) {
  console.error("\x1b[1m\x1b[91m" + message + "\x1b[0m");
}
