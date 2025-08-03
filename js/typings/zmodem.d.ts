declare module 'zmodem.js' {
    export function send(data: Buffer): Promise<void>;
    export function receive(): Promise<Buffer>;

    export interface SendFilesOptions {
        on_offer_response?: (file: File, xfer: any) => void;
    }

    export interface SentryOptions {
        to_terminal: (data: Uint8Array) => void;
        on_detect: (detection: Detection) => void;
        sender: (data: Uint8Array) => void;
        on_retract: () => void;
    }

    export interface FileDetails {
        name: string;
        size: number;
    }

    export class Browser {
        static save_to_disk(payloads: any, filename: string): void;
        static send_files(session: Session, files: FileList | null, options?: SendFilesOptions): Promise<void>;
    }

    export class Detection {
        confirm(): Session;
    }

    export class Offer {
        accept(): Promise<any>;
        skip(): void;
        get_details(): FileDetails;
        get_offset(): number;
    }

    export class Sentry {
        constructor(options: SentryOptions);
        consume(data: Uint8Array): void;
    }

    export class Session {
        type: "send" | "receive";
        on(event: string, callback: (...args: any[]) => void): void;
        start(): void;
        close(): void;
    }
}
