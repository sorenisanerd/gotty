/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */


import { Terminal, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-zmodem' {
  /**
   * An xterm.js addon that enables zmodem transfers.
   */
  export class ZModemAddon implements ITerminalAddon {
    /**
     * Creates a new zmodem addon.
     * @param handler The callback when the link is called.
     */
    constructor(handler?: (event: MouseEvent, uri: string) => void);

    /**
     * Activates the addon
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    /**
     * Disposes the addon.
     */
    public dispose(): void;
  }
}
