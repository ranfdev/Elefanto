/* window.js
 *
 * Copyright 2020 Lorenzo
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */



const { GObject, Gtk, Gio, GLib, Handy, Pango, Gdk } = imports.gi;
const { registerApp, getAuthorization, getToken, MClient } = imports.mastodonApi;
const System = imports.system;
const accounts = imports.accounts;
const utils = imports.utils;

var ElefantoWindow = GObject.registerClass({
	GTypeName: 'ElefantoWindow',
	Template: 'resource:///com/github/ranfdev/elefanto/window.ui',
	InternalChildren: [
		'deck', 'deckViewBox', 'stack1', 'writeTootView', 'leaflet',
		'timelinesView', 'homeTimelineBox', 'publicTimelineBox',
		'localTimelineBox', 'accountBtn', 'writeTootBtn',
		'writeTootBackBtn', 'switcherBar', 'switcherTitle',
		'statusText', 'cwBtn', 'spoilerText', 'privacyComboBox',
		'replyingToRevealer', 'replyingToBox', 'cancelReplyBtn',
	],

}, class extends Handy.ApplicationWindow {
	_init(application, userData) {
		super._init({ application });
		this.inReplyTo = {};
		this.start(userData).catch(log);

		this._deck.connect("notify::transition-running", () => {
			let toRemove = this.getLastDeckChild();
			if (
				!this._deck.transition_running &&
				toRemove != this._timelinesView &&
				toRemove != this._deck.get_visible_child()
			)
				this._deck.remove(toRemove);
		});

		// TODO: libhandy feature request: mode_transition_running
		// property leaflet

		this._leaflet.connect("notify::folded",
			this.updateResponsive.bind(this));

		this._switcherTitle.connect("notify::title-visible",
			this.updateResponsive.bind(this));

		this._cancelReplyBtn.connect("clicked", () => {
			this._replyingToRevealer.reveal_child = false;
		});

		this.updateResponsive();

		// let's bind everything now, so we can access these from everywhere
		this.action_back = this.action_back.bind(this);
		this.action_show_home_timeline = this.action_show_home_timeline.bind(this);
		this.action_show_local_timeline = this.action_show_local_timeline.bind(this);
		this.action_show_public_timeline = this.action_show_public_timeline.bind(this);
		this.action_open_accounts_view = this.action_open_accounts_view.bind(this);
		this.action_write_toot = this.action_write_toot.bind(this);

		this.action_toggle_boost = this.action_toggle_boost.bind(this);
		this.action_toggle_favourite = this.action_toggle_favourite.bind(this);


		// prefix win
		this.actions = utils.createActions({
			"back": {
				accels: ["<Alt>Left"],
				activate: this.action_back
			},
			"show-home-timeline": {
				accels: ["<Alt>1"],
				activate: this.action_show_home_timeline
			},
			"show-local-timeline": {
				accels: ["<Alt>2"],
				activate: this.action_show_local_timeline
			},
			"show-public-timeline": {
				accels: ["<Alt>3"],
				activate: this.action_show_public_timeline
			},
			"open-accounts-view": {
				accels: ["<Alt>a"],
				activate: this.action_open_accounts_view
			},
			"write-toot": {
				accels: ["<Primary>n"],
				activate: this.action_write_toot
			},
			"use-account": {
				activate: this.action_use_account,
				parameter_type: "s",
			},
			"send-toot": {
				activate: this.action_send_toot
			}
		});
		for (let k in this.actions) {
			this.add_action(this.actions[k])
		}
	}

	// actions

	action_back(test) {
		if (this._leaflet.folded &&
			this._leaflet.visible_child == this._writeTootView) {
			this._leaflet.visible_child = this._deckViewBox;
			return;
		}
		let children = this._deck.get_children();
		let previous = children[children.length-2];
		if (typeof previous != "undefined") {
			this._deck.set_visible_child(previous);
		}
	}
	action_open_accounts_view() {
		if (this._leaflet.folded && this._leaflet.visible_child == this._writeTootView) {
			this._leaflet.visible_child = this._deckViewBox;
		}

		this.addView(new AccountsView());
	}
	action_write_toot() {
		this._leaflet.visible_child = this._writeTootView;
	}

	action_show_home_timeline() {
		this._stack1.visible_child = this._homeTimelineBox;
	}
	action_show_local_timeline() {
		this._stack1.visible_child = this._localTimelineBox;
	}
	action_show_public_timeline() {
		this._stack1.visible_child = this._publicTimelineBox;
	}
	action_use_account(action, fileName) {
		new ElefantoWindow(application, accounts.loadAccount(fileName.unpack()));
	}
	action_send_toot() {
		this.client.publishStatus(
				this._statusText.buffer.text,
				this._cwBtn.active,
				this._spoilerText.text,
				this._privacyComboBox.active_id,
				this.replyingTo).catch(log)
	}
	expandStatus(status) {
		this.addView(new ExpandedStatus(status));
	}
	replyTo(status) {
		this.replyingTo = status;
		this._replyingToRevealer.reveal_child = false;
		// If the post id == "", just close the replyingToRevealer
		if (status == null) {
			return;
		}

		let previousWidgets = this._replyingToBox.get_children();
		if (previousWidgets.length > 0) {
			this._replyingToBox.remove(previousWidgets[0]);
		}
		this.action_write_toot();

		this._replyingToBox.add(new Toot(status));
		this._replyingToRevealer.check_resize();
		this._replyingToRevealer.reveal_child = true;
	}

	// end of actions

	// toot actions (actions are inside Toot, handler is inside Window)
	// because window has access to this.client, Toot doesn't.

	action_toggle_boost(action, id) {
		let state = action.state.unpack();
		//this.client[state ? "unReblog" : "reblog"](id.unpack());
		action.change_state(new GLib.Variant("b", !state));
	}
	action_toggle_favourite(action, id) {
		let state = action.state.unpack();
		//this.client[state ? "unFavourite" : "favourite"](id.unpack());
		action.change_state(new GLib.Variant("b", !state));
	}

	// end of toot actions

	showAccount(account) {
		this.addView(new AccountView(account));
	}
	updateResponsive() {
		this._writeTootBtn.visible = this._leaflet.folded;
		this._writeTootBackBtn.visible = this._leaflet.folded;
		this._switcherBar.reveal = this._switcherTitle.title_visible;
	}
	getLastDeckChild() {
		let children = this._deck.get_children();
		return children[children.length-1];
	}
	async start(userData) {
		try {
			if (typeof userData == "undefined") {

				userData = await this.showLoginDialog();

				this.client = new MClient(userData.instance, userData.access_token);
				this.account = await this.client.verifyCredentials();
				accounts.saveAccount(this.account.username, userData.instance, userData.access_token);
			} else {
				this.client = new MClient(userData.instance, userData.access_token);
				this.account = await this.client.verifyCredentials();
			}
		} catch (e) {
			log("Error while trying to verify credentials: " + e);
		}

		let timelinesMetadata = [
			{
				container: this._publicTimelineBox,
				provider: this.client.getPublicTimeline.bind(this.client)
			},
			{
				container: this._localTimelineBox,
				provider: this.client.getLocalTimeline.bind(this.client)
			},
			{
				container: this._homeTimelineBox,
				provider: this.client.getHomeTimeline.bind(this.client)
			}
		]

		for (let t of timelinesMetadata) {
			let timeline = new Timeline(t.provider, this.client);

			t.container.add(timeline);
		}

		this.show_all();
	}

	async showLoginDialog() {
		let loginDialog = new LoginDialog();

		loginDialog.set_transient_for(this);
		loginDialog.show_all();
		return new Promise((res,rej) => loginDialog.connect("close", () => {
			res(loginDialog.resultData);
		}));
	}


	addView(widget) {
		this._deck.add(widget);
		this._deck.set_visible_child(widget);
		this._leaflet.set_visible_child(this._deckViewBox);
	}

});

var TootTopBar = GObject.registerClass({
	GTypeName: 'TootTopBar',
	Template: 'resource:///com/github/ranfdev/elefanto/ui/TootTopBar.ui',
	InternalChildren: [
		'actionLabel', 'actorBtn'
	],
}, class extends Gtk.Box {
	_init(account, action) {
		super._init();

		this._actionLabel.label = action;
		this._account = account;
		this._actorBtn.label = account.display_name || account.username;

		this.connect("realize", () => {
			this._mainWindow = this.get_toplevel();
			this._client = this._mainWindow.client;
		});

		this._actorBtn.connect("clicked", () => {
			this._mainWindow.showAccount(this._account);
		});
	}
});

var Toot = GObject.registerClass({
	GTypeName: 'Toot',
	Template: 'resource:///com/github/ranfdev/elefanto/ui/Toot.ui',
	InternalChildren: [
		'displayName', 'acct', 'avatar', 'accountBtn',
		'statusLabel', 'time', 'replyBtn',
		'boostBtn', 'favouriteBtn'
	],
}, class extends Gtk.Box {
	_init(status) {
		super._init();

		this.setStatus(status);

		this.connect("realize", () => {
			this._mainWindow = this.get_toplevel();
			this._client = this._mainWindow.client;
			this.addHandlers();
		})
	}
	setStatus(status) {
		this._status = status;
		this._internalStatus = this._status.reblog || this._status;

		if (this._status != this._internalStatus) {
			const topBar = new TootTopBar(this._status.account, _("Boosted"));
			this.setTopBar(topBar);
		}

		this._displayName.label = this._internalStatus.account.display_name;
		this._acct.label = this._internalStatus.account.acct;
		this._time.label = this._internalStatus.created_at;

		this._statusLabel.label = utils.unescape(this._internalStatus.content);

		this._boostBtn.active = this._internalStatus.reblogged;
		this._boostBtn.sensitive = this._internalStatus.visibility != "direct";
		this._favouriteBtn.active = this._internalStatus.favourited;

	}
	setTopBar(topBar) {
		this.pack_start(topBar, false, true, 5);
		this.reorder_child(topBar, 0);
	}
	addHandlers() {
		this._accountBtn.connect("clicked", this.onAccountBtnClicked.bind(this));
		this._replyBtn.connect("clicked", this.onReplyBtnClicked.bind(this));
		this._boostBtn.connect("toggled", this.onBoostBtnToggled.bind(this));
		this._favouriteBtn.connect("toggled", this.onFavouriteBtnToggled.bind(this));
	}
	onReplyBtnClicked() {
		this._mainWindow.replyTo(this._internalStatus);
	}
	onAccountBtnClicked() {
		this._mainWindow.showAccount(this._internalStatus.account);
	}
	async onBoostBtnToggled() {
		try {
			if (this._boostBtn.active) {
				await this._client.reblog(this._internalStatus.id);
			} else {
				await this._client.unReblog(this._internalStatus.id);
			}
			this.activeAccount.reblogged = true;
		} catch (e) {
			log(e);
		}
	}
	async onFavouriteBtnToggled() {
		try {
			if (this._favouriteBtn.active) {
				await this._client.favourite(this._internalStatus.id);
			} else {
				await this._client.unFavourite(this._internalStatus.id);
			}
			this.activeAccount.favourited = true;
		} catch (e) {
			log(e);
		}
	}
});

var Notification = GObject.registerClass({
	GTypeName: "Notification"
}, class extends Gtk.Box {
	_init(notification) {
		super._init({orientation: Gtk.Orientation.HORIZONTAL, spacing: 5});
		this.notif = notification;
		this._topBar = new TootTopBar(this.notif.account, this.getActionName());
		this.add(this._topBar);
		if (this.notif.status != null) {
			this._toot = new Toot(this.notif.status);
			this.add(this._toot);
		}
	}
	getActionName() {
		switch (this.notif.type) {
		case "follow":
			this._actionLabel = _("Started following you");
			break;
		case "mention":
			this._actionLabel = _("Mentioned you");
			break;
		case "reblog":
			this._actionLabel = _("Reblogged this");
			break;
		case "favourite":
			this._actionLabel = _("Favourited this");
			break;
		case "poll":
			this._actionLabel = _("Poll ended");
			break;
		}
	}
});

var TootsList = GObject.registerClass({
	GTypeName: 'TootsList',
}, class StatusList extends Gtk.ListBox {
	_init(statuses) {
		super._init({});
		this.statuses = statuses;
		this.get_style_context().add_class("preferences");
		for (let status of this.statuses) {
			let row = new Gtk.ListBoxRow();

				//this.get_toplevel().expandStatus(status);


			row.add(new Toot(status));
			this.add(row);
		}

	}
});

var Timeline = GObject.registerClass({
	GTypeName: 'Timeline',
}, class Timeline extends Gtk.ScrolledWindow {
	_init(statusProvider) {
		super._init({});
		this.vexpand = true;
		this.statusProvider = statusProvider;

		// Needed to prevent making more than 1 request of new posts at a time.
		this.lockLoading = false;

		this.nMapped = 0;
		this.minId = "";
		this.maxId = "";

		this.box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 5});

		this.btnLoadNewer = new Gtk.Button({label: _("Load newer")});
		this.btnLoadOlder = new Gtk.Button({label: _("Load older")});

		this.btnLoadNewer.connect("clicked", () => this.loadData({min_id: this.minId}));
		this.btnLoadOlder.connect("clicked", () => this.loadData({max_id: this.maxId}));


		this.box.pack_start(this.btnLoadNewer, false, true, 10);
		this.box.pack_end(this.btnLoadOlder, false, true, 10);

		this.add(this.box);

		this.tootsList = null;

		this.connect("map", () => {
			if (this.nMapped == 0) {
				this.loadData();
			}
			this.nMapped++;
		});
	}
	async loadData(providerParams) {
		if (this.lockLoading) {
			return;
		}

		try {
			this.lockLoading = true;
			let statuses = await this.statusProvider(providerParams);
			if (statuses.length > 0) {
				if (this.tootsList != null) {
					this.box.remove(this.tootsList);
				}
				this.tootsList = new TootsList(statuses);
				this.box.pack_start(this.tootsList, false, true, 0);
				this.vadjustment.value = 0;

				this.show_all();
				this.minId = statuses[0].id;
				this.maxId = statuses[statuses.length - 1].id;
			}

		} catch (e) {
			log(e)
		} finally {
			this.lockLoading = false;
		}
	}
});

var AccountRow = GObject.registerClass({
	GTypeName: 'AccountRow',
	Template: 'resource:///com/github/ranfdev/elefanto/ui/AccountRow.ui',
	InternalChildren: ['avatar'],
}, class AccountRow extends Handy.ActionRow {
	_init(fileInfo) {
		this.fileName = fileInfo.get_name();
		let [title, subtitle] = accounts.parseFilename(this.fileName);
		super._init({title, subtitle});

		this.fileInfo = fileInfo;
	}
})

var AccountsView = GObject.registerClass({
	GTypeName: 'AccountsView',
	Template: 'resource:///com/github/ranfdev/elefanto/ui/AccountsView.ui',
	InternalChildren: ['accountsListBox', 'addBtn'],
}, class AccountsView extends Gtk.Box {
	_init() {
		super._init();

		// TODO: run app without any account
		this._addBtn.connect('clicked', () => {
			application.run(null);
		});

		for (let a of accounts.listAll()) {
			let row = new AccountRow(a);
			row.action_name = "win.use-account";
			row.action_target = new GLib.Variant("s", row.fileName);

			this._accountsListBox.add(row);
		}

	}

})

var AccountView = GObject.registerClass({
	GTypeName: 'AccountView',
	Template: 'resource:///com/github/ranfdev/elefanto/ui/AccountView.ui',
	InternalChildren: [
		'acct', 'displayName', 'scrolledWindow', 'fields', 'followBtn',
		'menuBtn', 'note', 'toots', 'follows', 'followers', 'viewContent'
	],
}, class extends Gtk.Box {
	_init(account) {
		log(account)
		super._init();

		this.account = account;

		this._acct.label = "" + account.acct;
		this._displayName.label = "" + account.display_name || account.username;
		this._note.label = utils.unescape(account.note);

		this._toots.label = "" + account.statuses_count;
		this._follows.label = "" + account.following_count;
		this._followers.label = "" + account.followers_count;

		let rowc = 0;
		for (let field of account.fields) {
			this._fields.attach(new Gtk.Label({
				wrap: true,
				wrap_mode: Pango.WrapMode.WORD_CHAR,
				label: field.name, xalign: 0
			}), 0, rowc, 1,1);
			this._fields.attach(new Gtk.Label({
				xalign: 0,
				wrap: true,
				wrap_mode: Pango.WrapMode.WORD_CHAR,
				label: utils.unescape(field.value)

			}), 1, rowc, 1,1);
			this._fields.attach(new Gtk.Separator(),0,rowc+1,2,1);
			rowc+=2;
		}


		this.connect("realize", () => {
			this.timeline = new Timeline((...args) =>
			this.get_toplevel().client.getUserTimeline("" + account.id, ...args));

			this.timeline.vscrollbar_policy = Gtk.PolicyType.NEVER;

			this._viewContent.add(this.timeline);
			this.show_all();
		})
	}
})

var ExpandedStatus = GObject.registerClass({
	GTypeName: 'ExpandedStatus',
	Template: 'resource:///com/github/ranfdev/elefanto/ui/ExpandedStatus.ui',
	InternalChildren: ['viewContent'],
}, class extends Gtk.Box {
	_init(statusId) {
		super._init();
		this.statusId = statusId;
		this.connect("realize", this.loadContext.bind(this));
	}
	async loadContext() {
		let window = this.get_toplevel();
		let client = window.client;

		try {
			let context = await client.getContext(this.statusId);
			let status = await client.getStatus(this.statusId);

			let statuses = [...context.ancestors, status, ...context.descendants];

			let toots = new TootsList(statuses);
			this._viewContent.add(toots);

			this.show_all();
		} catch (e) {
			log(e)
		}

	}
})


var LoginDialog = GObject.registerClass({
	GTypeName: 'LoginDialog',
	Template: 'resource:///com/github/ranfdev/elefanto/ui/loginDialog.ui',
	InternalChildren: [
		'authCodeEntry', 'instanceUrlEntry', 'stack',
		'page0', 'page1'
	],
	Signals: {
		"close": {flags: GObject.SignalFlags.RUN_FIRST}
	}
}, class LoginDialog extends Handy.Window {
	_init() {
		super._init();
		this.addActions();
		this.resetState();
	}
	addActions() {
		this.actions = utils.createActions({
			"go-forward": {
				activate: this.action_go_forward.bind(this)
			},
			"go-back": {
				activate: this.action_go_back.bind(this)
			}
		});

		let actionGroup = new Gio.SimpleActionGroup();

		for (let k in this.actions) {
			actionGroup.add_action(this.actions[k]);
		}
		this.insert_action_group("dialog", actionGroup);
	}
	action_go_forward() {
		let instance = this._instanceUrlEntry.text;

		if (this._stack.position == 0 && instance != "") {
			this._stack.scroll_to(this._page1);
			this.actions["go-back"].enabled = true;

			registerApp(instance, "Elefanto")
				.then(({client_id, client_secret}) => {
					this._client_id = client_id;
					this._client_secret = client_secret;
					getAuthorization(instance, client_id);
				}).catch(log);

		} else {
			let auth_code = this._authCodeEntry.text;
			getToken(instance,
				this._client_id,
				this._client_secret,
				auth_code)
				.then((data) => {
					this.resultData = {instance, access_token: data.access_token};
					log(instance)
					log(data.access_token)
					this.emit("close");
					this.hide();

				})
				.catch(log)
		}
	}
	action_go_back() {
		this.resetState();
	}
	resetState() {
		this._stack.scroll_to(this._page0);
		this.actions["go-back"].enabled = false;
	}
});

