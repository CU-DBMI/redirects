import { addError, list } from "./core";

// for each redirect
await Promise.all(
  list.map(async ({ to }) => {
    try {
      // do simple request to target url
      const response = await fetch(to);
      if (
        // only fail on certain status codes that might indicate link is "broken"
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
