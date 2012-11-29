const Lang = imports.lang;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
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

const NotifyPopup = new Lang.Class({
    Name: 'NotifyPopup',
    Extends: ModalDialog.ModalDialog,

    _init: function(params) {
        this.parent({
            shellReactive: true
        });
        this._dialogLayout = 
            typeof this.dialogLayout === "undefined"
            ? this._dialogLayout
            : this.dialogLayout

        this._dialogLayout.set_style_class_name('notify-popup-modal');

        this.params = Params.parse(params, {
            text: 'Nothing',
            icon_name: ICONS.information,
            timeout: 600 // ms
        });

        let label = new St.Label({
            text: this.params.text,
            style_class: 'notify-popup-label'
        });
        let icon = new St.Icon({
            icon_name: this.params.icon_name,
            style_class: 'notify-popup-icon'
        });

        let notify_table = new St.Table({
            name: 'notify_popup_table',
            style_class: 'notify-popup-box'
        })
        notify_table.add(icon, {
            row: 0,
            col: 0
        });
        notify_table.add(label, {
            row: 0,
            col: 1
        });

        this._dialogLayout.add(notify_table);
    },

    display: function() {
        if(this._timeout_id != 0) {
            Mainloop.source_remove(this._timeout_id);
            this._timeout_id = 0;
        }

        this._timeout_id = Mainloop.timeout_add(
            this.params.timeout,
            Lang.bind(this, this._on_timeout)
        );
        this.open();
    },

    _on_timeout : function() {
        if(this._timeout_id != 0) {
            Mainloop.source_remove(this._timeout_id);
            this._timeout_id = 0;
        }

        this.close();
        this.destroy();
    },

    destroy: function() {
        if(this._timeout_id != 0) {
            Mainloop.source_remove(this._timeout_id);
            this._timeout_id = 0;
        }

        this.parent();
    }
});

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

    _search_from_clipboard: function() {
        this._clipboard.get_text(Lang.bind(this, function(clipboard, text) {
            if(Utils.is_blank(text)) {
                show_popup(
                    'Clipboard is empty.',
                    ICONS.information,
                    750
                );
            }
            else {
                text = encodeURIComponent(text);
                let url = this._settings.get_string(Prefs.ENGINE_KEY).replace(
                    '{term}',
                    text
                );
                let popup_params = {
                    text: 'Searching...',
                    icon_name: ICONS.information,
                    timeout: 600
                };
                this._open_url(url, popup_params);
            }
        }));
    },

    _go_from_clipboard: function() {
        this._clipboard.get_text(Lang.bind(this, function(clipboard, url) {
            if(Utils.is_blank(url)) {
                show_popup(
                    'Clipboard is empty.',
                    ICONS.information,
                    750
                );
            }
            else {
                let popup_params = {
                    text: 'Opening..."',
                    icon_name: ICONS.information,
                    timeout: 850
                };
                this._open_url(url, popup_params);
            }
        }));
    },

    _open_url: function(url, popup_params) {
        url = Utils.get_url(url);

        if(!url) {
            show_popup(
                'Invalid url.',
                ICONS.error,
                750
            );
        }
        else {
            popup_params = Params.parse(popup_params, {
                text: false,
                icon_name: ICONS.information,
                timeout: 650
            });

            if(popup_params.text) {
                show_popup(
                    popup_params.text,
                    popup_params.icon_name,
                    popup_params.timeout
                );
            }
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
        global.display.add_keybinding(
            Prefs.SEARCH_SHORTCUT_KEY,
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Lang.bind(this, function() {
                this._search_from_clipboard();
            })
        );

        global.display.add_keybinding(
            Prefs.GO_SHORTCUT_KEY,
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Lang.bind(this, function() {
                this._go_from_clipboard();
            })
        );
    },

    disable: function() {
        global.display.remove_keybinding(Prefs.SEARCH_SHORTCUT_KEY);
        global.display.remove_keybinding(Prefs.GO_SHORTCUT_KEY);
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

let search_from_clipboard;

function init() {
    search_from_clipboard = new SearchFromClipboard();
}

function enable() {
    search_from_clipboard.enable();
}

function disable() {
    search_from_clipboard.disable();
}
