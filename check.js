import { addError, getList, onExit } from "./core";

onExit();

// check list of redirects for broken links
async function checkList(list) {
  return await Promise.all(
    // for each redirect
    list.map(async ({ to }) => {
      try {
        // do simple request to target url
        const response = await fetch(to);
        if (
          // only fail on certain status codes that might indicate link is "broken"
          // select as desired from https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
          [
            400, 404, 405, 406, 408, 409, 410, 421, 500, 501, 502, 503, 504,
          ].includes(response.status)
        )
          throw Error(response.status);
      } catch (error) {
        addError(`"to: ${to}" may be a broken link\n(${error})`);
      }
    })
  );
}

await checkList(getList());
