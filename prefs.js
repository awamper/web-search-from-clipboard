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

const SearchFromClpiboardPrefsWidget = new GObject.Class({
    Name: 'SearchFromClpiboard.Prefs.Widget',
    GTypeName: 'SearchFromClpiboardPrefsWidget',
    Extends: Gtk.Grid,

    _init: function(params) {
        this.parent(params);

        this.margin = this.row_spacing = this.column_spacing = 10;
        this._rownum = 0;
        Gtk.Settings.get_default().gtk_button_images = true;

        this._settings = Utils.getSettings();

        // search engine
        this.add_entry(
            'Search engine:',
            ENGINE_KEY
        );

        // search shortcuts
        this.add_shortcut(
            'Clipboard search:',
            SEARCH_SHORTCUT_KEY
        );
        this.add_shortcut(
            'Primary selection search<sup>*</sup>:',
            SEARCH_PRIMARY_SHORTCUT_KEY
        );

        // go shortcut
        this.add_shortcut(
            'Open url shortcut:',
            GO_SHORTCUT_KEY
        );
        this.add_shortcut(
            'Open url from primary selection<sup>*</sup>:',
            GO_PRIMARY_SHORTCUT_KEY
        );

        let text =
            '<sup>*</sup>requires <a href="http://sourceforge.net/'+
            'projects/xclip/">xclip</a>';
        this.add_item(new Gtk.Label({
            label: text,
            use_markup: true
        }));
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

function init(){
    // nothing
}

function buildPrefsWidget() {
    let widget = new SearchFromClpiboardPrefsWidget();
    widget.show_all();

    return widget;
}
