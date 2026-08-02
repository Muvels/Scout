export type Product = {
  name: string;
  home: string;
};

export type Perform = (action: () => Promise<unknown>) => void;

/**
 * How the omnibox commits its input: 'navigate' drives the current tab
 * (⌘L), 'create' opens a new one (⌘T), matching what a URL bar and a new
 * tab do in a desktop browser.
 */
export type OmniboxMode = 'navigate' | 'create';

/** Which window edge the sidebar column sits on. */
export type SidebarSide = 'left' | 'right';
