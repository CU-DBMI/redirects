const { readdirSync, readFileSync, writeFileSync } = require("fs");
const { parse } = require("yaml");

// get yaml files in this repo
const files = readdirSync(__dirname).filter((file) => /\.ya?ml$/.test(file));

// start master list of redirects
const list = [];

// save errors for reporting later
const errors = [];

// go through each yaml file
for (const file of files) {
  // load file contents
  const contents = readFileSync(file, "utf8");

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
  for (const [index, entry] of Object.entries(data)) {
    const log = `${file} entry ${Number(index) + 1}`;

    // check if dict
    if (typeof entry !== "object") {
      errors.push(`${log} is not a dict`);
      continue;
    }

    // check "from" field
    if (!(typeof entry.from === "string" && entry.from.trim())) {
      errors.push(`${log} "from" field invalid`);
      continue;
    }

    // check "to" field
    if (!(typeof entry.to === "string" && entry.to.trim()))
      errors.push(`${log} "to" field invalid`);

    // normalize "from" field. lower case, remove leading slashes.
    entry.from = entry.from.toLowerCase().replace(/^(\/+)/, "");

    // keep record of source yaml file
    entry._source = file;

    // append to master list
    list.push(entry);
  }
}

console.info("Combined redirects list:", list);

// check for duplicate "from" fields
const counts = {};
for (const { from, _source } of list) {
  if (!counts[from]) counts[from] = {};
  if (!counts[from][_source]) counts[from][_source] = 0;
  counts[from][_source]++;
}
for (const [from, sources] of Object.entries(counts)) {
  const total = Object.values(sources).reduce((sum, count) => sum + count, 0);
  if (total <= 1) continue;
  const duplicates = Object.entries(sources)
    .map(([source, count]) => `${count} in ${source}`)
    .join(", ");
  errors.push(`"from: ${from}" has duplicates: ${duplicates}`);
}

// report and throw errors
if (errors.length) {
  errors.forEach((message) => console.warn(message));
  // only throw (exit) at end so we get full report without multiple runs
  throw new Error(`There were ${errors.length} errors`);
}

// encode redirect list to base64 to obfuscate
const encoded = Buffer.from(JSON.stringify(list)).toString("base64");

console.info("Encoded redirects list:", encoded);

// redirect script from website repo
const script = "./redirects-website/redirect.js";

// load contents of script
const contents = readFileSync(script, "utf8").toString();

// pattern to extract encoded redirect list from script string
const regex = /(list\s*=\s*")([A-Za-z0-9+\/=]*)(")/s;

// get encoded redirect list currently in script
const currentEncoded = contents.match(regex)?.[2];

// check that we could find it (and thus can replace it)
if (typeof currentEncoded !== "string")
  throw new Error("Couldn't parse redirect script");

console.info("Previous encoded redirects list:", currentEncoded);

// update encoded string in script
const newContents = contents.replace(regex, "$1" + encoded + "$3");

// write updated redirect script to website repo
writeFileSync(script, newContents, "utf-8");
