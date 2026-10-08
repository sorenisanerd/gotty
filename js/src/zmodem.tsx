import { Component, ComponentChildren, createRef, render } from "preact";
import { ITerminalAddon, Terminal } from "@xterm/xterm";
import { Browser } from "zmodem.js/src/zmodem_browser";
import { Sentry } from "zmodem.js";
import type { Detection, Offer, Session } from "zmodem.js";
import { Button, MyModal } from "./MyModal";

export class ZModemAddon implements ITerminalAddon {
    term!: Terminal;
    elem!: HTMLDivElement;
    sentry!: Sentry;

    toTerminal: (data: Uint8Array) => void;
    toServer: (data: Uint8Array) => void;

    constructor(props: {
        toTerminal: (data: Uint8Array) => void,
        toServer: (data: Uint8Array) => void
    }) {
        this.createElement();
        this.toTerminal = props.toTerminal;
        this.toServer = props.toServer;

        this.init();
    }

    private createElement() {
        this.elem = document.createElement("div");
        document.body.prepend(this.elem);
    }

    consume(data: Uint8Array) {
        try {
            this.sentry.consume(data)
        } catch (e) {
            console.warn("ZModem protocol error:", e);
            this.reset();
        }
    }

    activate(terminal: Terminal): void {
        this.term = terminal
    }

    dispose() {
    }

    private init() {
        render(<></>, this.elem);

        this.sentry = new Sentry({
            'to_terminal': (d: Uint8Array) => this.toTerminal(d),
            'on_detect': (detection: Detection) => this.onDetect(detection),
            'sender': (x: Uint8Array) => { this.toServer(x) },
            'on_retract': () => this.reset(),
        });
    }

    private reset() {
        this.init();
        this.term.options.disableStdin = false;
        this.term.focus();
    }

    private onDetect(detection: Detection) {
        var zsession = detection.confirm();

        this.term.options.disableStdin = true;

        zsession.on('session_end', () => { this.reset() });

        if (zsession.type === "send") {
            this.send(zsession);
        }
        else {
            zsession.on("offer", (xfer: any) => this.onOffer(xfer));
            zsession.start();
        }
    }

    private send(zsession: Session) {
        render(<SendFileModal session={zsession} />, this.elem)
    }

    private onOffer(xfer: Offer) {
        render(<ReceiveFileModal xfer={xfer} onFinish={() => this.reset()} />, this.elem)
    }
}

// Renders a bootstrap progress bar
function Progress(props: { min: number, max: number, now: number, children?: ComponentChildren }) {
    let { min, max, now } = props;
    let percentage = "0";

    if ((typeof min === "number") &&
        (typeof max === "number") &&
        (typeof now === "number") &&
        (min != max)) {
        percentage = (100 * (now - min) / (max - min)).toFixed(0);
    }

    return <div class="progress">
        <div class="progress-bar" role="progressbar" style={"width: " + percentage + "%"} aria-valuenow={now} aria-valuemin={min} aria-valuemax={max}>{props.children}</div>
    </div>
}

interface ReceiveFileModalProps {
    xfer: Offer;
    onFinish?: () => void;
}

interface ReceiveFileModalState {
    state: "notstarted" | "started" | "skipped" | "done"
}

export class ReceiveFileModal extends Component<ReceiveFileModalProps, ReceiveFileModalState> {
    // Guards against handling the offer twice — a button click and the modal's
    // dismiss handler can both fire.
    private finished = false;

    constructor(props: ReceiveFileModalProps) {
        super(props)
        this.setState({ state: "notstarted" })
    }

    accept() {
        this.setState({ state: "started" });

        let timerID = setInterval(
            () => this.forceUpdate(),
            100
        );

        this.props.xfer.accept().then((payloads: any) => {
            this.finished = true;
            // All done, so stop updating the progress bar
            // and perform a final render.
            clearInterval(timerID);
            this.forceUpdate();

            if (this.state.state != "skipped") {
                Browser.save_to_disk(
                    payloads,
                    this.props.xfer.get_details().name
                );
            }
            this.setState({ state: "done" })
        })
    }

    finish() {
        console.log('finished');
        if (this.props.onFinish) this.props.onFinish();
    }

    progress() {
        if (this.state.state !== "notstarted") {
            return <Progress min={0} max={this.props.xfer.get_details().size} now={this.props.xfer.get_offset()} />
        }
    }

    // Decline the offered file. Used by the Decline/Cancel buttons and by the
    // modal's dismiss handler (✕/Esc/backdrop). Dismissing previously did
    // nothing, which left the terminal frozen with stdin disabled; the ZSKIP
    // ends the session and 'session_end' drives ZModemAddon.reset().
    skip() {
        if (this.finished) {
            return;
        }
        this.finished = true;
        this.props.xfer.skip()
        this.setState({ state: "skipped" })
    }

    buttons() {
        switch (this.state.state) {
            case "notstarted":
                return <>
                    <Button priority="primary" clickHandler={() => { this.accept(); }}>Accept</Button>
                    <Button priority="secondary" clickHandler={() => { this.skip(); }}>Decline</Button>
                </>
            case "started":
                return <>
                    <Button priority="danger" clickHandler={() => { this.skip(); }}>Cancel</Button>
                </>
            case "skipped":
                return <>
                    <Button priority="danger" disabled={true}>Skipping...</Button>
                </>
        }
    }

    render() {
        if (this.state.state != "done")
            return <MyModal title="Incoming file"
                buttons={this.buttons()}
                dismissHandler={() => { this.skip(); }}>
                Accept <code>{this.props.xfer.get_details().name}</code> ({this.props.xfer.get_details().size.toLocaleString(undefined, { maximumFractionDigits: 0 })} bytes)?
                {this.progress()}
            </MyModal>
    }
}


export class SendFileModal extends Component<SendFileModalProps, SendFileModalState> {
    filePickerRef = createRef<HTMLInputElement>();
    // Guards against aborting the session twice — a Cancel click and the
    // modal's dismiss handler can both fire.
    private finished = false;

    constructor(props: SendFileModalProps) {
        super(props)
        this.setState({ state: "notstarted" })
    }

    buttons() {
        switch (this.state.state) {
            case "started":
                return <>
                    <Button priority="secondary" clickHandler={() => { this.cancel(); }}>Cancel</Button>
                    <Button priority="primary" clickHandler={() => { this.send(); }} disabled={true}>
                        Sending...
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    </Button>
                </>
            case "notstarted":
                return <>
                    <Button priority="secondary" clickHandler={() => { this.cancel(); }}>Cancel</Button>
                    <Button priority="primary" clickHandler={() => { this.send(); }}>Send</Button>
                </>
            default:
                return
        }
    }

    // Decline the pending transfer and hand control back to the terminal.
    // session.abort() sends the ZMODEM abort sequence and fires 'session_end',
    // which drives ZModemAddon.reset() — clearing the modal and re-enabling
    // stdin. Without this the terminal stays frozen (issue #137).
    cancel() {
        if (this.finished) {
            return;
        }
        this.finished = true;
        try {
            this.props.session.abort();
        } catch (e) {
            console.log(e);
        }
        if (this.props.onFinish !== undefined) {
            this.props.onFinish();
        }
    }

    send() {
        Browser.send_files(this.props.session,
            this.filePickerRef.current!.files, {
                on_offer_response: (f, xfer) => {
                    this.setState({ state: "started" })
                },
            }
        ).then(() => {
            this.finished = true;
            this.setState({ state: "done" });
            this.props.session.close();
            if (this.props.onFinish !== undefined) {
                this.props.onFinish();
            }
        }).catch(e => {
            console.log(e);
            this.cancel();
        });
    }

    render() {
        if (this.state.state != "done")
            return <MyModal title="Send file(s)"
                buttons={this.buttons()}
                dismissHandler={() => { this.cancel(); }}>
                <div class="mb-3">
                    <label for="formFileMultiple" class="form-label">
                        Remote requested file transfer
                    </label>
                    <input ref={this.filePickerRef} class="form-control form-control-sm" type="file" id="formFileMultiple" multiple />
                </div>
            </MyModal>
    }
}

interface SendFileModalProps {
    onFinish?: () => void;
    session: Session;
}

interface SendFileModalState {
    state: "notstarted" | "started" | "done"
    currentFile: any
}
