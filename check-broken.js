import { addError, getLists, onExit, trace } from "./core";

onExit();

// only fail on certain status codes that might indicate link is "broken"
// select as desired from https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
const statuses = [
  400, 404, 405, 406, 408, 409, 410, 421, 500, 501, 502, 503, 504,
];

// check list of redirects for broken links
async function checkBroken(lists) {
  return await Promise.all(
    // for each redirect file
    Object.entries(lists)
      .map(([, list]) =>
        // for each redirect
        list.map(async (entry) => {
          try {
            // do simple request to target url
            const response = await fetch(entry.to);
            if (statuses.includes(response.status))
              throw Error(response.status);
          } catch (error) {
            addError([
              `"to" may be a broken link`,
              `to: ${entry.to}`,
              error,
              trace(entry),
            ]);
          }
        })
      )
      .flat()
  );
}

await checkBroken(getLists());
