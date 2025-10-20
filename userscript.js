// ==UserScript==
// @name         NALA-J Userscript
// @namespace    konst
// @version      1
// @description  Blocks beforeunload prompts, auto-starts practice, reflows layout with history on the right, and binds Space to re-play audio.
// @match        https://www2.kobe-u.ac.jp/~kawatsu/nala/nala2022.02/*
// @run-at       document-start
// @all-frames   true
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const HISTORY_IDS = ['recentHistory', 'historyTable'];
    const PLAY_BUTTON_ID = 'playQuestionButton';
    const STYLE_ID = 'nala-layout-style';

    let layoutObserver = null;
    let historyMoving = false;
    let shortcutBound = false;

    const LAYOUT_CSS = `
:root {
  --nala-layout-gap: clamp(18px, 2.5vw, 28px);
  --nala-main-max-width: 720px;
  --nala-history-width: clamp(220px, 24vw, 300px);
  --nala-sticky-top: clamp(16px, 2.8vw, 32px);
  font-size: clamp(18px, 1.3vw, 20px);
}

body {
  font-size: clamp(0.92rem, 0.9rem + 0.2vw, 1.02rem);
  line-height: 1.65;
  overflow-x: hidden;
}

/* Fallback layout when the enhancement script is not active */
#wrapper:not(.nala-upgraded) {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(520px, 3fr);
  gap: 24px;
  align-items: flex-start;
}

#wrapper:not(.nala-upgraded) > header {
  grid-column: 1;
  align-self: flex-start;
  position: sticky;
  top: 24px;
}

#wrapper:not(.nala-upgraded) > main {
  grid-column: 2;
  display: grid;
  grid-template-columns: minmax(400px, 2fr) minmax(220px, 1fr);
  column-gap: 24px;
  row-gap: 18px;
  align-items: flex-start;
  justify-items: center;
  grid-auto-rows: min-content;
}

#wrapper:not(.nala-upgraded) > main > * {
  grid-column: 1;
  justify-self: center;
  width: min(100%, var(--nala-main-max-width));
}

#wrapper:not(.nala-upgraded) > main > #recentHistory,
#wrapper:not(.nala-upgraded) > main > #historyTable {
  grid-column: 2;
  justify-self: stretch;
  width: auto;
  align-self: start;
}

#wrapper:not(.nala-upgraded) > main > *:not(#recentHistory):not(#historyTable) {
  text-align: center;
}

#wrapper:not(.nala-upgraded) > main > #recentHistory {
  grid-row: 1;
}

#wrapper:not(.nala-upgraded) > main > #historyTable {
  grid-row: 2;
}

/* Enhanced three-column layout when the script runs */
#wrapper.nala-upgraded {
  max-width: min(1400px, calc(100vw - clamp(16px, 2vw, 24px) * 2));
  margin: 0 auto;
  padding: clamp(16px, 2vw, 24px);
  box-sizing: border-box;
  font-size: clamp(0.92rem, 0.9rem + 0.2vw, 1.02rem);
}

#wrapper.nala-upgraded > #nalaColumns {
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(540px, 2fr) minmax(var(--nala-history-width), 1fr);
  grid-template-areas: "nav main history";
  gap: var(--nala-layout-gap);
  align-items: flex-start;
}

#wrapper.nala-upgraded > #nalaColumns > header {
  grid-area: nav;
  font-size: clamp(0.82rem, 0.85rem + 0.15vw, 0.95rem);
  position: sticky;
  top: var(--nala-sticky-top);
  align-self: flex-start;
}

#wrapper.nala-upgraded > #nalaColumns > header .pageTitle {
  font-size: clamp(0.9rem, 0.95rem + 0.1vw, 1.05rem);
}

#wrapper.nala-upgraded > #nalaColumns > header li,
#wrapper.nala-upgraded > #nalaColumns > header a {
  font-size: clamp(0.78rem, 0.8rem + 0.1vw, 0.9rem);
}

main.nala-main-column {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: clamp(14px, 2vw, 24px);
  align-items: center;
  font-size: clamp(0.98rem, 0.95rem + 0.2vw, 1.08rem);
}

main.nala-main-column > * {
  width: min(100%, var(--nala-main-max-width));
  font-size: inherit;
}

main.nala-main-column > *:not(#recentHistory):not(#historyTable) {
  text-align: center;
}

#questionText {
  font-size: clamp(1.9rem, 2.8vw, 2.4rem);
}

#judgeResultArea {
  min-height: 3.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  font-size: clamp(1.05rem, 1.0rem + 0.2vw, 1.15rem);
}

#nalaHistoryColumn {
  grid-area: history;
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 1.6vw, 20px);
  position: sticky;
  top: var(--nala-sticky-top);
  max-height: calc(100vh - var(--nala-sticky-top) - clamp(16px, 2vw, 24px));
  align-self: flex-start;
  font-size: clamp(0.8rem, 0.82rem + 0.15vw, 0.92rem);
}

#nalaHistoryColumn > * {
  width: min(var(--nala-history-width), 100%);
  max-width: 100%;
  font-size: inherit;
}

#nalaHistoryColumn #historyTable {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  font-size: clamp(0.85rem, 0.87rem + 0.15vw, 0.98rem);
}

#nalaHistoryColumn #historyTableArea {
  flex: 1 1 auto;
  overflow-y: auto;
}

button,
input[type="button"],
input[type="submit"],
input[type="image"] {
  white-space: nowrap;
  word-break: keep-all;
  font-size: clamp(0.95rem, 0.9rem + 0.2vw, 1.05rem);
}

#historyTable th,
#historyTable td {
  font-size: clamp(0.78rem, 0.8rem + 0.12vw, 0.9rem);
}

@media (max-width: 1200px) {
  #wrapper.nala-upgraded > #nalaColumns {
    grid-template-columns: minmax(200px, 0.9fr) minmax(520px, 2fr) minmax(240px, 0.9fr);
    grid-template-areas: "nav main history";
  }
}

@media (max-width: 1080px) {
  #wrapper:not(.nala-upgraded) {
    grid-template-columns: minmax(200px, 1fr) minmax(420px, 3fr);
    gap: 20px;
  }

  #wrapper:not(.nala-upgraded) > main {
    grid-template-columns: minmax(360px, 2fr) minmax(200px, 1fr);
    grid-auto-rows: min-content;
  }

  #wrapper.nala-upgraded > #nalaColumns {
    grid-template-columns: minmax(220px, 1fr) minmax(520px, 2fr);
    grid-template-areas:
      "nav main"
      "history history";
  }

  #nalaHistoryColumn {
    position: static;
    max-height: none;
  }

  #nalaHistoryColumn > * {
    width: 100%;
  }
}

@media (max-width: 900px) {
  #wrapper:not(.nala-upgraded) {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  #wrapper:not(.nala-upgraded) > main {
    grid-column: 1;
    grid-template-columns: 1fr;
    justify-items: stretch;
  }

  #wrapper:not(.nala-upgraded) > main > * {
    grid-column: 1;
    max-width: none;
  }

  #wrapper:not(.nala-upgraded) > header {
    position: static;
    grid-column: 1;
  }

  #wrapper.nala-upgraded {
    padding: clamp(12px, 2.4vw, 18px);
  }

  #wrapper.nala-upgraded > #nalaColumns {
    grid-template-columns: 1fr;
    grid-template-areas:
      "nav"
      "main"
      "history";
  }

  #wrapper.nala-upgraded > #nalaColumns > header,
  main.nala-main-column,
  #nalaHistoryColumn {
    grid-column: 1;
    position: static;
    width: 100%;
  }

  main.nala-main-column > * {
    width: 100%;
  }
}
`;

    // -------------------------------
    // Safety: block beforeunload prompts
    // -------------------------------
    function harden(win) {
        if (!win || win.__nala_hardened__) return;
        win.__nala_hardened__ = true;

        // Block addEventListener('beforeunload', ...)
        try {
            const ET = win.EventTarget && win.EventTarget.prototype;
            if (ET && !ET.__nala_patched__) {
                ET.__nala_patched__ = true;
                const add = ET.addEventListener;
                const remove = ET.removeEventListener;
                Object.defineProperty(ET, 'addEventListener', {
                    value(type, listener, options) {
                        if (type === 'beforeunload') return;
                        return add.call(this, type, listener, options);
                    },
                    configurable: true,
                });
                Object.defineProperty(ET, 'removeEventListener', {
                    value(type, listener, options) {
                        return remove.call(this, type, listener, options);
                    },
                    configurable: true,
                });
            }
        } catch (_) {
            /* ignore */
        }

        const nullifyProp = (obj, prop) => {
            if (!obj) return;
            try {
                Object.defineProperty(obj, prop, {
                    get() {
                        return null;
                    },
                    set() {
                        return true;
                    },
                    configurable: true,
                });
            } catch (_) {
                /* ignore */
            }
            try {
                obj[prop] = null;
            } catch (_) {
                /* ignore */
            }
        };

        nullifyProp(win, 'onbeforeunload');
        nullifyProp(win.document, 'onbeforeunload');

        try {
            const BUE =
                (win.BeforeUnloadEvent && win.BeforeUnloadEvent.prototype) ||
                null;
            if (BUE && !BUE.__nala_patched__) {
                BUE.__nala_patched__ = true;

                const rvDesc = Object.getOwnPropertyDescriptor(
                    BUE,
                    'returnValue'
                );
                if (!rvDesc || rvDesc.configurable) {
                    Object.defineProperty(BUE, 'returnValue', {
                        get() {
                            return undefined;
                        },
                        set() {
                            /* ignore */
                        },
                        configurable: true,
                    });
                }

                const origPD = BUE.preventDefault;
                if (origPD && !origPD.__nala_pd__) {
                    const noop = function () {};
                    noop.__nala_pd__ = true;
                    Object.defineProperty(BUE, 'preventDefault', {
                        value: noop,
                        configurable: true,
                    });
                }
            }
        } catch (_) {
            /* ignore */
        }

        try {
            const EP = win.Event && win.Event.prototype;
            if (EP && !EP.__nala_returnpatched__) {
                EP.__nala_returnpatched__ = true;
                const rv = Object.getOwnPropertyDescriptor(EP, 'returnValue');
                if (!rv || rv.configurable) {
                    Object.defineProperty(EP, 'returnValue', {
                        get() {
                            return undefined;
                        },
                        set() {
                            /* ignore */
                        },
                        configurable: true,
                    });
                }
            }
        } catch (_) {
            /* ignore */
        }

        try {
            win.addEventListener(
                'beforeunload',
                (e) => {
                    try {
                        if (typeof e.stopImmediatePropagation === 'function') {
                            e.stopImmediatePropagation();
                        }
                        Object.defineProperty(e, 'returnValue', {
                            value: undefined,
                            writable: true,
                            configurable: true,
                        });
                    } catch (_) {
                        /* ignore */
                    }
                },
                { capture: true }
            );
        } catch (_) {
            /* ignore */
        }

        function sweep() {
            try {
                win.onbeforeunload = null;
            } catch (_) {}
            try {
                win.document.onbeforeunload = null;
            } catch (_) {}
            try {
                const frames =
                    win.document && win.document.querySelectorAll('iframe');
                frames.forEach((frame) => {
                    try {
                        if (frame.contentWindow) harden(frame.contentWindow);
                    } catch (_) {}
                });
            } catch (_) {
                /* ignore */
            }
        }

        sweep();

        try {
            const mo = new win.MutationObserver(sweep);
            mo.observe(win.document.documentElement, {
                childList: true,
                subtree: true,
            });
        } catch (_) {
            /* ignore */
        }

        win.setInterval(sweep, 800);
    }

    // --------------------------------
    // Auto-click "Start" button
    // --------------------------------
    function clickStartButtonIn(win) {
        if (!win || !win.document) return;

        const tryClick = () => {
            try {
                const btn = win.document.querySelector('#startButton');
                if (btn && !btn.disabled && btn.isConnected) {
                    btn.click();
                    try {
                        if (typeof win.onClickStartButton === 'function') {
                            win.onClickStartButton();
                        }
                    } catch (_) {
                        /* ignore */
                    }
                    return true;
                }
            } catch (_) {
                /* ignore */
            }
            return false;
        };

        const attempts = [0, 60, 160, 400, 1000, 2000];
        attempts.forEach((ms) => win.setTimeout(tryClick, ms));

        try {
            const mo = new win.MutationObserver(() => {
                tryClick();
            });
            mo.observe(win.document.documentElement, {
                childList: true,
                subtree: true,
            });
        } catch (_) {
            /* ignore */
        }

        try {
            win.document.querySelectorAll('iframe').forEach((frame) => {
                try {
                    if (frame.contentWindow)
                        clickStartButtonIn(frame.contentWindow);
                } catch (_) {
                    /* ignore */
                }
            });
        } catch (_) {
            /* ignore */
        }
    }

    // --------------------------------
    // Layout helpers
    // --------------------------------
    function injectStylesheet() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = LAYOUT_CSS;
        document.head.appendChild(style);
    }

    function ensureHistoryColumn() {
        if (historyMoving) return;

        const wrapper = document.getElementById('wrapper');
        if (!wrapper || !wrapper.classList.contains('nala-upgraded')) return;

        const main =
            wrapper.querySelector('main.nala-main-column') ||
            wrapper.querySelector('main');
        const historyColumn =
            document.getElementById('nalaHistoryColumn') ||
            wrapper.querySelector('#nalaHistoryColumn');
        if (!main || !historyColumn) return;

        historyMoving = true;
        try {
            HISTORY_IDS.forEach((id) => {
                const panel = document.getElementById(id);
                if (panel && panel.parentElement !== historyColumn) {
                    historyColumn.appendChild(panel);
                }
            });
        } finally {
            historyMoving = false;
        }
    }

    function normalizeHref(href) {
        if (!href) return '';
        try {
            const url = new URL(href, window.location.href);
            url.hash = '';
            let pathname = decodeURIComponent(url.pathname);
            pathname = pathname
                .replace(/index\.html?$/i, '')
                .replace(/\/+$/, '');
            const search = url.search || '';
            if (url.protocol === 'file:') {
                return `${pathname}${search}`;
            }
            return `${url.origin}${pathname}${search}`;
        } catch (_) {
            return href.replace(/#.*$/, '');
        }
    }

    function removeNavToggle() {
        const column =
            document.getElementById('nav-column') ||
            document.getElementById('nav-content')?.parentElement;
        if (!column) return;

        ['nav-input', 'nav-open', 'nav-close'].forEach((id) => {
            const el = document.getElementById(id);
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });

        column.querySelectorAll('label[for="nav-input"]').forEach((label) => {
            const fragment = document.createDocumentFragment();
            while (label.firstChild) {
                fragment.appendChild(label.firstChild);
            }
            label.replaceWith(fragment);
        });

        if (!column.id) {
            column.id = 'nav-column';
        }
    }

    function expandNavigation() {
        const nav = document.getElementById('nav-content');
        if (!nav) return;

        nav.querySelectorAll('details.globalMenuDetails').forEach((details) => {
            if (!details.open) details.open = true;
            if (!details.dataset.nalaLock) {
                details.dataset.nalaLock = '1';
                details.addEventListener('toggle', () => {
                    if (!details.open) {
                        details.open = true;
                    }
                });
            }
        });

        const currentHref = normalizeHref(window.location.href);
        let bestLink = null;
        let bestScore = 0;

        nav.querySelectorAll('a[href]').forEach((link) => {
            const linkHref = normalizeHref(link.getAttribute('href'));
            const absoluteHref = normalizeHref(link.href);
            let score = 0;

            if (absoluteHref === currentHref) {
                score = 1_000_000;
            } else if (currentHref.endsWith(absoluteHref)) {
                score = absoluteHref.length;
            } else if (absoluteHref.endsWith(currentHref)) {
                score = currentHref.length;
            } else if (linkHref && currentHref.endsWith(linkHref)) {
                score = linkHref.length;
            }

            if (score > bestScore) {
                bestLink = link;
                bestScore = score;
            }
        });

        nav.querySelectorAll('.nala-current-link').forEach((el) => {
            el.classList.remove('nala-current-link');
        });
        nav.querySelectorAll('.nala-current-item').forEach((el) => {
            el.classList.remove('nala-current-item');
        });

        if (bestLink) {
            bestLink.classList.add('nala-current-link');
            const item = bestLink.closest('li');
            if (item) item.classList.add('nala-current-item');
        }

        normalizeNavLinks(nav);
    }

    function normalizeNavLinks(navRoot) {
        const nav = navRoot || document.getElementById('nav-content');
        if (!nav) return;

        nav.querySelectorAll('li').forEach((li) => {
            const anchor = li.querySelector('a[href]');
            if (!anchor) return;

            if (
                li.childNodes.length === 1 &&
                li.firstElementChild === anchor &&
                anchor.childNodes.length > 0
            ) {
                return;
            }

            const newAnchor = anchor.cloneNode(false);
            Array.from(li.childNodes).forEach((node) => {
                if (node === anchor) {
                    while (anchor.firstChild) {
                        newAnchor.appendChild(anchor.firstChild);
                    }
                } else {
                    newAnchor.appendChild(node);
                }
            });
            li.replaceChildren(newAnchor);
        });
    }

    function restructureLayout() {
        const wrapper = document.getElementById('wrapper');
        if (!wrapper) return;

        let columns = document.getElementById('nalaColumns');
        if (!columns) {
            columns = document.createElement('div');
            columns.id = 'nalaColumns';
        }

        let historyColumn = document.getElementById('nalaHistoryColumn');
        if (!historyColumn) {
            historyColumn = document.createElement('aside');
            historyColumn.id = 'nalaHistoryColumn';
        }

        const header =
            wrapper.querySelector(':scope > header') ||
            columns.querySelector(':scope > header') ||
            document.querySelector('header');
        const main =
            wrapper.querySelector(':scope > main') ||
            columns.querySelector(':scope > main') ||
            document.querySelector('main');

        const order = [];
        if (header) order.push(header);
        if (main) order.push(main);
        order.push(historyColumn);
        columns.replaceChildren(...order);

        if (columns.parentElement !== wrapper) {
            wrapper.appendChild(columns);
        }

        wrapper.classList.add('nala-upgraded');
        if (main) main.classList.add('nala-main-column');

        removeNavToggle();
        ensureHistoryColumn();
        expandNavigation();
        normalizeNavLinks();

        if (!layoutObserver && wrapper) {
            layoutObserver = new MutationObserver(() => {
                removeNavToggle();
                ensureHistoryColumn();
                expandNavigation();
                normalizeNavLinks();
            });
            layoutObserver.observe(wrapper, {
                childList: true,
                subtree: true,
            });
        }
    }

    // --------------------------------
    // Spacebar -> replay audio
    // --------------------------------
    function bindShortcut() {
        if (shortcutBound) return;
        shortcutBound = true;

        const isEditable = (element) => {
            if (!element) return false;
            if (element.isContentEditable || element.tagName === 'TEXTAREA')
                return true;
            if (element.tagName === 'INPUT') {
                return [
                    'text',
                    'search',
                    'email',
                    'url',
                    'tel',
                    'password',
                    'number',
                    'date',
                    'time',
                    'datetime-local',
                ].includes((element.type || '').toLowerCase());
            }
            return false;
        };

        const handler = (event) => {
            const isSpace =
                event.code === 'Space' ||
                event.key === ' ' ||
                event.key === 'Spacebar';
            if (!isSpace) return;

            const active = document.activeElement;
            if (isEditable(active)) return;

            const button = document.getElementById(PLAY_BUTTON_ID);
            if (!button) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();

            if (
                active &&
                active !== button &&
                typeof active.blur === 'function'
            ) {
                active.blur();
            }

            if (event.type === 'keydown' && !event.repeat) {
                button.click();
                if (typeof button.blur === 'function') {
                    requestAnimationFrame(() => button.blur());
                }
            }
        };

        ['keydown', 'keyup', 'keypress'].forEach((type) => {
            document.addEventListener(type, handler, true);
        });
    }

    // --------------------------------
    // Master init
    // --------------------------------
    function enhance() {
        injectStylesheet();
        restructureLayout();
        bindShortcut();
    }

    function onReady() {
        harden(window);
        clickStartButtonIn(window);
        enhance();
    }

    harden(window);
    clickStartButtonIn(window);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } else {
        onReady();
    }

    window.addEventListener('load', onReady, { once: true });
})();
