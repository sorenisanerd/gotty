import { ConnectionFactory } from "./websocket";
import { WebTTY, protocols } from "./webtty";
import { GoTTYXterm } from "./xterm";
import { initThemePicker } from "./theme-picker";

// @TODO remove these
declare var gotty_auth_token: string;
declare var gotty_term: string;
declare var gotty_ws_query_args: string;
declare var gotty_preferences: Record<string, unknown>;
declare var gotty_confirm_close: boolean;

const elem = document.getElementById("terminal")

if (elem !== null) {
    var term: GoTTYXterm;
    term = new GoTTYXterm(elem, gotty_preferences);
    initThemePicker(term.term, () => term.refit());

    // Confirm-close guard. When enabled, ask the browser to confirm before the
    // page unloads while a session is connected. It is armed on connect and
    // disarmed on disconnect, so that once the shell exits (e.g. the user hits
    // Ctrl-D) the page can be closed without a prompt. Note that the browser
    // only shows the dialog after the user has interacted with the page, and
    // its wording cannot be customized.
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        // Assigning returnValue (even an empty string) is what asks the browser
        // to show the confirmation dialog.
        event.returnValue = "";
    };
    let confirmCloseArmed = false;
    const setConfirmClose = (armed: boolean) => {
        if (!gotty_confirm_close || armed === confirmCloseArmed) {
            return;
        }
        confirmCloseArmed = armed;
        if (armed) {
            window.addEventListener("beforeunload", beforeUnloadHandler);
        } else {
            window.removeEventListener("beforeunload", beforeUnloadHandler);
        }
    };

    const httpsEnabled = window.location.protocol == "https:";
    const queryArgs = (gotty_ws_query_args === "") ? "" : "?" + gotty_ws_query_args;
    const url = (httpsEnabled ? 'wss://' : 'ws://') + window.location.host + window.location.pathname + 'ws' + queryArgs;
    const args = window.location.search;
    const factory = new ConnectionFactory(url, protocols);
    const wt = new WebTTY(term, factory, args, gotty_auth_token);
    wt.onConnect = () => { setConfirmClose(true); };
    wt.onDisconnect = () => { setConfirmClose(false); };
    const closer = wt.open();

    // According to https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event
    // this event is unreliable and in some cases (Firefox is mentioned), having an
    // "unload" event handler can have unwanted side effects. Consider commenting it out.
    window.addEventListener("unload", () => {
        closer();
        term.close();
    });
};
