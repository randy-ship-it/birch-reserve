/**
 * Coordination between the chat widget and the linger email-capture card so they are
 * never on screen together (Randy 6:50pm): the card never shows while chat is open,
 * and the chat launcher hides while the card is showing.
 */
export const CHAT_STATE_EVENT = "birch:chat-state";
export const LINGER_STATE_EVENT = "birch:linger-state";

type BusWindow = Window & { __birchChatOpen?: boolean; __birchLingerOpen?: boolean };

export function setChatOpen(open: boolean): void {
  const w = window as BusWindow;
  w.__birchChatOpen = open;
  window.dispatchEvent(new CustomEvent(CHAT_STATE_EVENT, { detail: { open } }));
}

export function isChatOpen(): boolean {
  return typeof window !== "undefined" && Boolean((window as BusWindow).__birchChatOpen);
}

export function setLingerOpen(open: boolean): void {
  const w = window as BusWindow;
  w.__birchLingerOpen = open;
  window.dispatchEvent(new CustomEvent(LINGER_STATE_EVENT, { detail: { open } }));
}

export function isLingerOpen(): boolean {
  return typeof window !== "undefined" && Boolean((window as BusWindow).__birchLingerOpen);
}
