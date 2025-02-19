import { addError, getList, onExit, trace } from "./core";

onExit();

// only fail on certain status codes that might indicate link is "broken"
// select as desired from https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
const statuses = [
  400, 404, 405, 406, 408, 409, 410, 421, 500, 501, 502, 503, 504,
];

// check list of redirects for broken links
async function checkBroken(list) {
  // for each redirect
  return await Promise.all(
    list.map(async (entry) => {
      try {
        // do simple request to target url
        const response = await fetch(entry.to);
        if (statuses.includes(response.status)) throw Error(response.status);
      } catch (e) {
        addError([
          `"to" may be a broken link`,
          `to: ${entry.to}`,
          e,
          trace(entry),
        ]);
      }
    })
  );
}

await checkBroken(getList());
