import { readFileSync, writeFileSync } from "fs";
import { addError, getList, onExit, verbose } from "./core";

onExit();

// encode list of redirects into redirect script
function encodeList(list) {
  // encode redirect list to base64 to obfuscate
  const encoded = Buffer.from(JSON.stringify(list)).toString("base64");

  if (verbose) log("Encoded redirects list", encoded);

  // redirect script from website repo
  const script = "./website-repo/redirect.js";

  // load contents of script
  let contents = "";
  try {
    contents = readFileSync(script, "utf8").toString();
  } catch (error) {
    addError(`Couldn't find script file at ${script}`);
  }

  // pattern to extract encoded redirect list from script string
  const regex = /(list\s*=\s*")([A-Za-z0-9+\/=]*)(")/;

  // get encoded redirect list currently in script
  const oldEncoded = contents.match(regex)?.[2];

  if (verbose) log("Old encoded redirects list", oldEncoded);

  // check that we could find it (and thus can replace it)
  if (typeof oldEncoded !== "string")
    addError("Couldn't find encoded redirects list in redirect script");

  // update encoded string in script
  const newContents = contents.replace(regex, "$1" + encoded + "$3");

  // write updated redirect script to website repo
  try {
    writeFileSync(script, newContents, "utf-8");
  } catch (error) {
    addError(`Couldn't write script file to ${script}`);
  }
}

encodeList(getList());
