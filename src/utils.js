const {Gio, GLib} = imports.gi;

/* Create an action group from a declaration.
  actions is an object: {
    "open-accounts-view": {
      accels: ["<Alt>a"],
      activate: this.action_open_accounts_view.bind(this)
    },
    "write-toot": {
      accels: ["<Primary>n"],
      activate: this.action_write_toot.bind(this)
    },
    "show-account": {
      parameter_type: "s",
      activate: this.action_show_account.bind(this)
    }
  }
*/

function createActions(actionsDef) {
	let actions = {};

  	for (let name in actionsDef) {
		// extract action definition data
		let {parameter_type, accels, activate, state} = actionsDef[name];

		// this will be passed to the SimpleAction constructor
		let options = {name};

		// If the action accepts a parameter, add the parameter type
		// to the SimpleAction constructor
		if (typeof parameter_type != "undefined") {
			options.parameter_type = new GLib.VariantType(parameter_type);
		}

		if (typeof state != "undefined") {
			options.state = state;
		}

		let action = new Gio.SimpleAction(options);

		action.connect("activate", activate);

		// accels is a set of keyboard shortcuts
		if (typeof accels != "undefined") {
		application.set_accels_for_action("win."+name, accels);
		}

		actions[name] = action;
	}
	return actions;
}
function unescape(content) {
	return content
		.replace(/<.+?>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&apos;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, "\"");
}

function set_timeout(func, delay, ...args) {
	GLib.timeout_add(GLib.PRIORITY_LOW, delay, () => (func(...args), false))
}
	
