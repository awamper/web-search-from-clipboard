const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Params = imports.misc.params;
const ModalDialog = imports.ui.modalDialog;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Prefs = Me.imports.prefs;

const ICONS = {
    information: 'dialog-information-symbolic',
    error: 'dialog-error-symbolic'
};

const SearchFromClipboard = new Lang.Class({
    Name: 'SearchFromClipboard',

    _init: function() {
        this._settings = Utils.getSettings();
        this._clipboard = St.Clipboard.get_default();

        this.activate_window = false;
        this._window_handler_id = global.display.connect(
            'window-demands-attention',
            Lang.bind(this, this._on_window_demands_attention)
        );
    },

    _on_window_demands_attention: function(display, window) {
        if(this.activate_window) {
            this.activate_window = false;
            Main.activateWindow(window);
        }
    },

    _search_from_clipboard: function(clipboard_type) {
        this._clipboard.get_text(clipboard_type, Lang.bind(this, function(clipboard, text) {
            if(Utils.is_blank(text)) {
                Main.notify('Clipboard is empty.')
            }
            else {
                text = encodeURIComponent(text);
                let url = this._settings.get_string(Prefs.ENGINE_KEY).replace(
                    '{term}',
                    text
                );
                this._open_url(url, "Searching...");
            }
        }));
    },

    _go_from_clipboard: function(clipboard_type) {
        this._clipboard.get_text(clipboard_type, Lang.bind(this, function(clipboard, url) {
            if(Utils.is_blank(url)) {
                Main.notify('Clipboard is empty.')
            }
            else {
                this._open_url(url, "Opening...");
            }
        }));
    },

    _open_url: function(url, message) {
        url = Utils.get_url(url);

        if(!url) {
            Main.notify('Invalid url.')
        }
        else {
            if(!Utils.is_blank(message)) Main.notify(message);
        }

        this.activate_window = true;
        Gio.app_info_launch_default_for_uri(
            url,
            Utils._makeLaunchContext({
                timestamp: global.get_current_time()
            })
        );
    },

    enable: function() {
        Main.wm.addKeybinding(
            Prefs.SEARCH_SHORTCUT_KEY,
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.KeyBindingMode.NORMAL |
            Shell.KeyBindingMode.MESSAGE_TRAY |
            Shell.KeyBindingMode.OVERVIEW,
            Lang.bind(this, function() {
                this._search_from_clipboard(St.ClipboardType.CLIPBOARD);
            })
        );

        Main.wm.addKeybinding(
            Prefs.SEARCH_PRIMARY_SHORTCUT_KEY,
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.KeyBindingMode.NORMAL |
            Shell.KeyBindingMode.MESSAGE_TRAY |
            Shell.KeyBindingMode.OVERVIEW,
            Lang.bind(this, function() {
                this._search_from_clipboard(St.ClipboardType.PRIMARY);
            })
        );

        Main.wm.addKeybinding(
            Prefs.GO_SHORTCUT_KEY,
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.KeyBindingMode.NORMAL |
            Shell.KeyBindingMode.MESSAGE_TRAY |
            Shell.KeyBindingMode.OVERVIEW,
            Lang.bind(this, function() {
                this._go_from_clipboard(St.ClipboardType.CLIPBOARD);
            })
        );

        Main.wm.addKeybinding(
            Prefs.GO_PRIMARY_SHORTCUT_KEY,
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.KeyBindingMode.NORMAL |
            Shell.KeyBindingMode.MESSAGE_TRAY |
            Shell.KeyBindingMode.OVERVIEW,
            Lang.bind(this, function() {
                this._go_from_clipboard(St.ClipboardType.PRIMARY);
            })
        );
    },

    disable: function() {
        Main.wm.removeKeybinding(Prefs.SEARCH_SHORTCUT_KEY);
        Main.wm.removeKeybinding(Prefs.SEARCH_PRIMARY_SHORTCUT_KEY);
        Main.wm.removeKeybinding(Prefs.GO_SHORTCUT_KEY);
        Main.wm.removeKeybinding(Prefs.GO_PRIMARY_SHORTCUT_KEY);
        global.display.disconnect(this._window_handler_id);
    }
});

function show_popup(text, icon_name, timeout) {
    if(Utils.is_blank(text)) {
        return false;
    }
    else {
        let params = {};
        params.text = text;

        if(!Utils.is_blank(icon_name)) {
            params.icon_name = icon_name;
        }
        if((timeout | 0) > 0 && timeout % 1 == 0) {
            params.timeout = timeout;
        }

        let popup = new NotifyPopup(params);
        popup.display();

        return true;
    }
}

let search_from_clipboard = null;

function init() {
    // nothing
}

function enable() {
    search_from_clipboard = new SearchFromClipboard();
    search_from_clipboard.enable();
}

function disable() {
    if(search_from_clipboard != null) {
        search_from_clipboard.disable();
        search_from_clipboard = null;
    }
}
