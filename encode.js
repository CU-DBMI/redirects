const { readFileSync, writeFileSync } = require("fs");
const { resolve } = require("path");
const { globSync } = require("glob");
const { parse } = require("yaml");

// get yaml files that match glob pattern
const files = globSync("*.y?(a)ml", { cwd: __dirname });

log("Files", files);

// start master list of redirects
const list = [];

// save errors for reporting later
const errors = [];

// go through each yaml file
for (const file of files) {
  // load file contents
  const contents = readFileSync(resolve(__dirname, file), "utf8");

  log(`${file} contents`, contents);

  // try to parse as yaml
  let data;
  try {
    data = parse(contents);
  } catch (error) {
    errors.push(`Couldn't parse ${file}. Make sure it is valid YAML.`);
    continue;
  }

  // check if top level is list
  if (!Array.isArray(data)) {
    errors.push(`${file} is not a list`);
    continue;
  }

  // go through each entry
  for (let [index, entry] of Object.entries(data)) {
    index = Number(index) + 1;
    const trace = `${file} entry ${index}`;

    // check if dict
    if (typeof entry !== "object") {
      errors.push(`${trace} is not a dict`);
      continue;
    }

    // check "from" field
    if (!(typeof entry.from === "string" && entry.from.trim())) {
      errors.push(`${trace} "from" field invalid`);
      continue;
    }

    // check "to" field
    if (!(typeof entry.to === "string" && entry.to.trim()))
      errors.push(`${trace} "to" field invalid`);

    // normalize "from" field. lower case, remove leading slashes.
    entry.from = entry.from.toLowerCase().replace(/^(\/+)/, "");

    // keep record of source yaml file and entry number
    entry._source = file;
    entry._entry = index;

    // append to master list
    list.push(entry);
  }
}

log("Combined redirects list", list);

// check for duplicate "from" fields
const duplicates = {};
for (const entry of list)
  duplicates[entry.from] = [...(duplicates[entry.from] || []), entry];
for (const [from, entries] of Object.entries(duplicates)) {
  const count = entries.length;
  if (count <= 1) continue;
  const duplicates = entries
    .map(({ _source, _entry }) => `\n${_source} entry ${_entry}`)
    .join("");
  errors.push(`"from: ${from}" appears ${count} time(s): ${duplicates}`);
}

// report and throw errors
if (errors.length) {
  errors.forEach(error);
  // only throw (exit) at end so we get full report without multiple runs
  throw new Error(`${errors.length} error(s)`);
}

// encode redirect list to base64 to obfuscate
const encoded = Buffer.from(JSON.stringify(list)).toString("base64");

log("Encoded redirects list", encoded);

// redirect script from website repo
const script = "./website-repo/redirect.js";

// load contents of script
const contents = readFileSync(script, "utf8").toString();

// pattern to extract encoded redirect list from script string
const regex = /(list\s*=\s*")([A-Za-z0-9+\/=]*)(")/s;

// get encoded redirect list currently in script
const oldEncoded = contents.match(regex)?.[2];

// check that we could find it (and thus can replace it)
if (typeof oldEncoded !== "string")
  throw new Error("Couldn't parse redirect script");

log("Old encoded redirects list", oldEncoded);

// update encoded string in script
const newContents = contents.replace(regex, "$1" + encoded + "$3");

// write updated redirect script to website repo
writeFileSync(script, newContents, "utf-8");

// debug util
function log(message, data) {
  console.info("\033[1m\033[96m" + message + "\033[0m");
  console.log(data);
  console.log();
}
function error(message) {
  console.error("\033[1m\033[91m" + message + "\033[0m");
}
