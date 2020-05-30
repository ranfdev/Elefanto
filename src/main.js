/* main.js
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

pkg.initGettext();
pkg.initFormat();
pkg.require({
  'Gio': '2.0',
  'Gtk': '3.0',
  'Handy': '1'
});

const { Gio, Gtk, Handy } = imports.gi;

const { ElefantoWindow } = imports.window;

const accounts = imports.accounts;

function main(argv) {
    application = new Gtk.Application({
        application_id: 'com.github.ranfdev.elefanto',
        flags: Gio.ApplicationFlags.FLAGS_NONE,
    });

    application.connect('activate', app => {
        activeWindow = app.activeWindow;

        if (!activeWindow) {
            activeWindow = new ElefantoWindow(app, accounts.getRandom());
        }

        activeWindow.present();
    });

    return application.run(argv);
}
