const {GLib,Gio} = imports.gi;

// These function should be used to save, list and get accounts on the user
// system. A user account is composed of json data: {username, instance, access_token}.
// The file name of an account is composed by $name + "@" + base64(instance).
// The base64 is required, because the instance url contains "/" and it's used
// to separate directories.

const configDir = GLib.get_user_config_dir();
const accountsDir = createAccountsDir();

function createAccountsDir() {
  let file = Gio.File.new_for_path(configDir + "/accounts");
  if (!file.query_exists(null)) {
    let res = file.make_directory(null);
    if (!res) {
      throw new Exception("Can't create accounts dir");
    }
  }
  return file;

}

function saveAccount(username, instance, access_token) {
  let file = accountsDir.get_child(username + "@" + GLib.base64_encode(instance));
  let stream;
  if (!file.query_exists(null)) {
    stream = file.create_readwrite(Gio.FileCreateFlags.PRIVATE,null);
  } else {
    stream = file.open_readwrite(null);
  }
  let userData = {username, instance, access_token};
  let ok = stream.get_output_stream().write_all(JSON.stringify(userData), null);
  if (!ok) {
    throw new Exception("Error saving file");
  }
  return userData;
}

function listAll() {
  let enumerator = accountsDir.enumerate_children("", Gio.FileQueryInfoFlags.NONE, null);
  let files = [];
  let currentFile = null;
  while (currentFile = enumerator.next_file(null), currentFile != null) {
    files.push(currentFile);
  }
  return files;
}

function listAllNames() {
  let files = listAll();
  return files.map(f => f.get_name());
}

function getRandom() {
  let accounts = listAll();
  if (accounts.length == 0) {
    return undefined;
  }
  let randomFileName = accounts[0].get_name();
  let child = accountsDir.get_child(randomFileName);
  let data = String(child.load_contents(null)[1]);
  return JSON.parse(data);
}

function parseFilename(fileName) {
  let [username,base64Instance] = fileName.split("@");
  return [username, String.fromCharCode.apply(null, GLib.base64_decode(base64Instance))];
}

function loadAccount(fileName) {
  let child = accountsDir.get_child(fileName);
  let data = String(child.load_contents(null)[1]);
  return JSON.parse(data);
}
