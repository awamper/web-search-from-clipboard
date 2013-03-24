/** Credit:
 *  based off prefs.js from the gnome shell extensions repository at
 *  git.gnome.org/browse/gnome-shell-extensions
 */

const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Params = imports.misc.params;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const SEARCH_SHORTCUT_KEY = 'search-shortcut';
const SEARCH_PRIMARY_SHORTCUT_KEY = 'search-primary-selection-shortcut';
const GO_SHORTCUT_KEY = 'go-shortcut';
const GO_PRIMARY_SHORTCUT_KEY = 'go-primary-selection-shortcut';
const ENGINE_KEY = 'search-engine';

const SearchFromClipboardKeybindingsWidget = new GObject.Class({
    Name: 'SearchFromClipboard.Keybindings.Widget',
    GTypeName: 'SearchFromClipboardKeybindingsWidget',
    Extends: Gtk.Box,

    _init: function(keybindings) {
        this.parent();
        this.set_orientation(Gtk.Orientation.VERTICAL);

        this._keybindings = keybindings;
        this._settings = Utils.getSettings();

        let scrolled_window = new Gtk.ScrolledWindow();
        scrolled_window.set_policy(
            Gtk.PolicyType.AUTOMATIC,
            Gtk.PolicyType.AUTOMATIC
        );

        this._columns = {
            NAME: 0,
            ACCEL_NAME: 1,
            MODS: 2,
            KEY: 3
        };

        this._store = new Gtk.ListStore();
        this._store.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_INT,
            GObject.TYPE_INT
        ]);

        this._tree_view = new Gtk.TreeView({
            model: this._store,
            hexpand: true,
            vexpand: true
        });
        this._tree_view.get_selection().set_mode(Gtk.SelectionMode.SINGLE);

        let action_renderer = new Gtk.CellRendererText();
        let action_column = new Gtk.TreeViewColumn({
            'title': 'Action',
            'expand': true
        });
        action_column.pack_start(action_renderer, true);
        action_column.add_attribute(action_renderer, 'text', 1);
        this._tree_view.append_column(action_column);

        let keybinding_renderer = new Gtk.CellRendererAccel({
            'editable': true,
            'accel-mode': Gtk.CellRendererAccelMode.GTK
        });
        keybinding_renderer.connect('accel-edited',
            Lang.bind(this, function(renderer, iter, key, mods) {
                let value = Gtk.accelerator_name(key, mods);
                let [success, iterator ] =
                    this._store.get_iter_from_string(iter);

                if(!success) {
                    printerr("Can't change keybinding");
                }

                let name = this._store.get_value(iterator, 0);

                this._store.set(
                    iterator,
                    [this._columns.MODS, this._columns.KEY],
                    [mods, key]
                );
                this._settings.set_strv(name, [value]);
            })
        );

        let keybinding_column = new Gtk.TreeViewColumn({
            'title': 'Modify'
        });
        keybinding_column.pack_end(keybinding_renderer, false);
        keybinding_column.add_attribute(
            keybinding_renderer,
            'accel-mods',
            this._columns.MODS
        );
        keybinding_column.add_attribute(
            keybinding_renderer,
            'accel-key',
            this._columns.KEY
        );
        this._tree_view.append_column(keybinding_column);

        scrolled_window.add(this._tree_view);
        this.add(scrolled_window);

        this._refresh();
    },

    _refresh: function() {
        this._store.clear();

        for(let settings_key in this._keybindings) {
            let [key, mods] = Gtk.accelerator_parse(
                this._settings.get_strv(settings_key)[0]
            );

            let iter = this._store.append();
            this._store.set(iter,
                [
                    this._columns.NAME,
                    this._columns.ACCEL_NAME,
                    this._columns.MODS,
                    this._columns.KEY
                ],
                [
                    settings_key,
                    this._keybindings[settings_key],
                    mods,
                    key
                ]
            );
        }
    }
});

const SearchFromClipboardPrefsGrid = new GObject.Class({
    Name: 'SearchFromClipboard.Prefs.Grid',
    GTypeName: 'SearchFromClipboardPrefsGrid',
    Extends: Gtk.Grid,

    _init: function(params) {
        this.parent(params);

        this.margin = this.row_spacing = this.column_spacing = 10;
        this._rownum = 0;
        Gtk.Settings.get_default().gtk_button_images = true;

        this._settings = Utils.getSettings();
    },

    add_entry: function(text, key) {
        let item = new Gtk.Entry({
            hexpand: true
        });
        item.text = this._settings.get_string(key);
        this._settings.bind(key, item, 'text', Gio.SettingsBindFlags.DEFAULT);

        return this.add_row(text, item);
    },

    add_shortcut: function(text, settings_key) {
        let item = new Gtk.Entry({
            hexpand: true
        });
        item.set_text(this._settings.get_strv(settings_key)[0]);
        item.connect('changed', Lang.bind(this, function(entry) {
            let [key, mods] = Gtk.accelerator_parse(entry.get_text());

            if(Gtk.accelerator_valid(key, mods)) {
                let shortcut = Gtk.accelerator_name(key, mods);
                this._settings.set_strv(settings_key, [shortcut]);
            }
        }));

        return this.add_row(text, item);
    },

    add_boolean: function(text, key) {
        let item = new Gtk.Switch({
            active: this._settings.get_boolean(key)
        });
        this._settings.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);

        return this.add_row(text, item);
    },

    add_combo: function(text, key, list) {
        let item = new Gtk.ComboBoxText();

        for(let i = 0; i < list.length; i++) {
            let title = list[i].title.trim();
            let id = list[i].value.toString();
            item.insert(-1, id, title);
        }

        item.set_active_id(this._settings.get_int(key).toString());
        item.connect('changed', Lang.bind(this, function(combo) {
            let value = parseInt(combo.get_active_id(), 10);

            if(this._settings.get_int(key) !== value) {
                this._settings.set_int(key, value);
            }
        }));

        this.add_row(text, item);
    },

    add_spin: function(label, key, adjustment_properties, spin_properties) {
        adjustment_properties = Params.parse(adjustment_properties, {
            lower: 0,
            upper: 100,
            step_increment: 100
        });
        let adjustment = new Gtk.Adjustment(adjustment_properties);

        spin_properties = Params.parse(spin_properties, {
            adjustment: adjustment,
            numeric: true,
            snap_to_ticks: true
        }, true);
        let spin_button = new Gtk.SpinButton(spin_properties);

        spin_button.set_value(this._settings.get_int(key));
        spin_button.connect('value-changed', Lang.bind(this, function(spin) {
            let value = spin.get_value_as_int();

            if(this._settings.get_int(key) !== value) {
                this._settings.set_int(key, value);
            }
        }));

        return this.add_row(label, spin_button, true);
    },

    add_row: function(text, widget, wrap) {
        let label = new Gtk.Label({
            label: text,
            use_markup: true,
            hexpand: true,
            halign: Gtk.Align.START
        });
        label.set_line_wrap(wrap || false);

        this.attach(label, 0, this._rownum, 1, 1); // col, row, colspan, rowspan
        this.attach(widget, 1, this._rownum, 1, 1);
        this._rownum++;

        return widget;
    },

    add_item: function(widget, col, colspan, rowspan) {
        this.attach(
            widget,
            col || 0,
            this._rownum,
            colspan || 2,
            rowspan || 1
        );
        this._rownum++;

        return widget;
    }
});

const SearchFromClipboardPrefsWidget = new GObject.Class({
    Name: 'SearchFromClipboard.Prefs.Widget',
    GTypeName: 'SearchFromClipboardPrefsWidget',
    Extends: Gtk.Box,

    _init: function (params) {
        this.parent(params);
        this._settings = Utils.getSettings();

        let main_page = this._get_main_page();

        let notebook = new Gtk.Notebook({
            margin_left: 5,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 5,
            expand: true
        });

        notebook.append_page(main_page.page, main_page.label);

        this.add(notebook);
    },

    _get_main_page: function() {
        let page_label = new Gtk.Label({
            label: 'Settings'
        });
        let page = new SearchFromClipboardPrefsGrid();

        // search engine
        page.add_entry(
            'Search engine:',
            ENGINE_KEY
        );

        let keybindings = {};
        keybindings[SEARCH_SHORTCUT_KEY] =
            'Search from clipboard';
        keybindings[SEARCH_PRIMARY_SHORTCUT_KEY] =
            'Search from primary selection';
        keybindings[GO_SHORTCUT_KEY] =
            'Open url from clipboard';
        keybindings[GO_PRIMARY_SHORTCUT_KEY] =
            'Open url from primary selection';

        let keybindings_widget = new SearchFromClipboardKeybindingsWidget(
            keybindings
        );
        page.add_item(keybindings_widget)

        let result = {
            label: page_label,
            page: page
        };
        return result;
    },
});

function init(){
    // nothing
}

function buildPrefsWidget() {
    let widget = new SearchFromClipboardPrefsWidget();
    widget.show_all();

    return widget;
}
