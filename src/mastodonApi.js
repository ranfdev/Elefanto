const {Soup, Gtk} = imports.gi;
const {fetch} = imports.fetch;

const REDIRECT_TO_AUTH_CODE = "urn:ietf:wg:oauth:2.0:oob";



function buildUrl(base, path, params) {
  let url = Soup.URI.new_with_base(Soup.URI.new(base), path);
  let query = [];

  for (let p in params) {
    query.push(encodeURIComponent(p) + "=" + encodeURIComponent(params[p]));
  }

  query = query.join("&");

  url.set_query(query);

  return url.to_string(false);
}


// Custom Soup wrapper to easily fetch things

function easyFetch(method, base, path, params = {}, token) {
  return fetch(buildUrl(base, path, params), {
    method,
    headers: {
      "Authorization": "Bearer " + token
    }
  });
}

// This is the registration flow

function registerApp(instance, appName) {
  return easyFetch("POST", instance, "/api/v1/apps", {
    client_name: appName,
    redirect_uris: REDIRECT_TO_AUTH_CODE,
    scopes: "read write follow push"
  }).then(res => res.json());
}

function getAuthorization(instance, client_id) {
  Gtk.show_uri_on_window(null, buildUrl(instance, "/oauth/authorize", {
    client_id,
    redirect_uri: REDIRECT_TO_AUTH_CODE,
    response_type: "code",
    scope: "read write follow push"
  }), 0)
}

function getToken(instance, client_id, client_secret, code) {
  return easyFetch("POST", instance, "/oauth/token", {
    client_id,
    client_secret,
    redirect_uri: REDIRECT_TO_AUTH_CODE,
    grant_type: "authorization_code",
    code
  }).then(res => res.json());
}

var Visibility = {
  PRIVATE: "private",
  PUBLIC: "public",
  UNLISTED: "unlisted",
  DIRECT: "direct"
}


var MClient = class {
  constructor(instance, token) {
    this._instance = instance;
    this._token = token;


    // HOF to make fetching easier
    this.apiFetch = (method, path, params) => easyFetch(method, instance, path, params, token);
  }
  verifyCredentials() {
    return this.apiFetch("GET", "/api/v1/accounts/verify_credentials").then(res => res.json());
  }
  getPublicTimeline(params) {
    return this.apiFetch("GET", "/api/v1/timelines/public", params).then(res => res.json());
  }
  getLocalTimeline(params) {
    return this.apiFetch("GET", "/api/v1/timelines/public", {local: true, ...params}).then(res => res.json());
  }
  getHomeTimeline(params) {
    return this.apiFetch("GET", "/api/v1/timelines/home", {local: true, ...params}).then(res => res.json());
  }
  getUserTimeline(id, params) {
    return this.apiFetch("GET", `/api/v1/accounts/${id}/statuses`, params).then(res => res.json());
  }
  reblog(id) {
    return this.apiFetch("POST", `/api/v1/statuses/${id}/reblog`).then(res => res.json());
  }
  unReblog(id) {
    return this.apiFetch("POST", `/api/v1/statuses/${id}/unreblog`).then(res => res.json());
  }
  favourite(id) {
    return this.apiFetch("POST", `/api/v1/statuses/${id}/favourite`).then(res => res.json());
  }
  unFavourite(id) {
    return this.apiFetch("POST", `/api/v1/statuses/${id}/unfavourite`).then(res => res.json());
  }
  publishStatus(status, sensitive, spoiler_text, visibility, in_reply_to_id) {
    return this.apiFetch("POST", `/api/v1/statuses`, {status, sensitive, spoiler_text, visibility})
  }
  getAccount(id) {
    return this.apiFetch("GET", `/api/v1/accounts/${id}`).then(res => res.json());
  }
  getContext(id) {
    return this.apiFetch("GET", `/api/v1/statuses/${id}/context`).then(res => res.json());
  }
  getStatus(id) {
    return this.apiFetch("GET", `/api/v1/statuses/${id}`).then(res => res.json());
  }

}
