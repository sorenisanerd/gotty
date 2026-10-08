import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/preact";
import { Browser } from "zmodem.js/src/zmodem_browser";
import { ReceiveFileModal, SendFileModal } from "../zmodem";

// MyModal drives a bootstrap modal on mount; stub it so the tests exercise the
// component logic without needing bootstrap's DOM/transition machinery.
vi.mock("bootstrap", () => ({
  Modal: {
    getOrCreateInstance: () => ({ show() {}, hide() {} }),
  },
}));

// Build a fake ZMODEM session, as the `rz` (send) path receives one.
function makeSession() {
  return { abort: vi.fn(), close: vi.fn() } as any;
}

// Build a fake incoming offer, as the `sz` (receive) path receives one.
function makeOffer(overrides: Record<string, unknown> = {}) {
  return {
    accept: vi.fn().mockResolvedValue([]),
    skip: vi.fn(),
    get_details: () => ({ name: "file.txt", size: 12345 }),
    get_offset: () => 0,
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("SendFileModal (rz upload / #137)", () => {
  it("aborts the session when Cancel is clicked", () => {
    const session = makeSession();
    const { getByText } = render(<SendFileModal session={session} />);

    fireEvent.click(getByText("Cancel"));

    expect(session.abort).toHaveBeenCalledTimes(1);
  });

  it("ignores a second Cancel (and a later dismiss) after aborting once", () => {
    const session = makeSession();
    const { container, getByText } = render(<SendFileModal session={session} />);

    fireEvent.click(getByText("Cancel"));
    fireEvent.click(getByText("Cancel"));
    container.querySelector(".modal")!.dispatchEvent(new Event("hide.bs.modal"));

    expect(session.abort).toHaveBeenCalledTimes(1);
  });

  it("aborts the session when the modal is dismissed (X / Esc / backdrop)", () => {
    const session = makeSession();
    const { container } = render(<SendFileModal session={session} />);

    // MyModal wires dismissHandler to bootstrap's hide.bs.modal event.
    container.querySelector(".modal")!.dispatchEvent(new Event("hide.bs.modal"));

    expect(session.abort).toHaveBeenCalledTimes(1);
  });
});

describe("ReceiveFileModal (sz download / #136, #170)", () => {
  it("declines the offer via skip when Decline is clicked", () => {
    const xfer = makeOffer();
    const { container, getByText } = render(<ReceiveFileModal xfer={xfer} />);

    fireEvent.click(getByText("Decline"));
    // The buttons become a disabled "Skipping...", so assert the guard by
    // dismissing afterwards: it must not skip a second time.
    container.querySelector(".modal")!.dispatchEvent(new Event("hide.bs.modal"));

    expect(xfer.skip).toHaveBeenCalledTimes(1);
  });

  it("declines the offer when the modal is dismissed (X / Esc / backdrop)", () => {
    const xfer = makeOffer();
    const { container } = render(<ReceiveFileModal xfer={xfer} />);

    container.querySelector(".modal")!.dispatchEvent(new Event("hide.bs.modal"));

    expect(xfer.skip).toHaveBeenCalledTimes(1);
  });

  it("writes an accepted file to disk through Browser.save_to_disk", async () => {
    // Guards #136 end to end: if `Browser` were undefined (the bad root
    // import), this call would throw and the assertion would never be met.
    const payloads = [{ name: "file.txt", size: 12345 }];
    const xfer = makeOffer({ accept: vi.fn().mockResolvedValue(payloads) });
    const saveSpy = vi
      .spyOn(Browser, "save_to_disk")
      .mockImplementation(() => {});

    const { getByText } = render(<ReceiveFileModal xfer={xfer} />);
    fireEvent.click(getByText("Accept"));

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(payloads, "file.txt");
    });
  });
});
