const {Gio, Soup} = imports.gi;
const {ByteArray, toString} = imports.byteArray;

// currently doesn't support streaming data
class FetchResponse {
  constructor(msg) {
    this._msg = msg;
  }
  async json() {
    return JSON.parse(this._msg.response_body.data);
  }
  async text() {
    return this._msg.response_body.data;
  }
}


let soupSession = Soup.Session.new();
function fetch(url, {method, headers} = {}) {
  if (typeof method == "undefined") {
    method = "GET";
  }
  let msg = Soup.Message.new(method, url);

  if (typeof headers != "undefined") {
    for (let k in headers) {
      msg.request_headers.append(k, headers[k]);
    }
  }

  return new Promise((resolve, reject) =>
    soupSession.queue_message(msg, (session, msg) => {
        // status code 4xx or 5xx
        if (msg.status_code > 400 && msg.status_code < 600) {
          reject(msg.response_body.data)
        } else {
          resolve(new FetchResponse(msg));
        }
      }
    ));
}
