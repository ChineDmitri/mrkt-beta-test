// ==UserScript==
// @name         MRKT CS2 article popup
// @namespace    https://www.mrkt.land/
// @version      1.0.0
// @description  Open MRKT CS2 skin article pages in an in-page desktop-style popup.
// @match        https://www.mrkt.land/*
// @match        https://www.mrkt.land/*/skins/cs2*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  "use strict";

  const POPUP_ID = "mrkt-article-popup";
  const STORE_KEY = "mrktArticlePopupBounds";
  const ARTICLE_PATH_PARTS = ["skins", "cs2"];
  const UUID_PART_LENGTHS = [8, 4, 4, 4, 12];
  const HTML_ENTITIES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  let popup;
  let titleNode;
  let bodyNode;
  let openLink;
  let activeRequest = 0;
  let abortController = null;

  addCss();
  installClickInterceptor();
  installKeyboardClose();

  function installClickInterceptor() {
    document.addEventListener(
      "click",
      (event) => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const link = event.target.closest && event.target.closest("a[href]");
        if (!link) return;
        if (link.classList.contains("mrkt-popup-open")) return;

        const url = toArticleUrl(link.href);
        if (!url) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openArticle(url.href);
      },
      true
    );
  }

  function installKeyboardClose() {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && popup && !popup.hidden) {
        closePopup();
      }
    });
  }

  function toArticleUrl(rawUrl) {
    let url;

    try {
      url = new URL(rawUrl, window.location.href);
    } catch {
      return null;
    }

    if (url.origin !== window.location.origin) return null;
    url.hash = "";

    if (!isArticlePath(url.pathname)) return null;

    const locale = getCurrentLocale();
    const pathParts = getPathParts(url.pathname);
    if (locale && pathParts[0] === ARTICLE_PATH_PARTS[0]) {
      url.pathname = `/${locale}${url.pathname}`;
    }

    return url;
  }

  function isArticlePath(pathname) {
    const parts = getPathParts(pathname);
    const routeParts = isLocaleSegment(parts[0]) ? parts.slice(1) : parts;

    return (
      routeParts.length === 3 &&
      routeParts[0] === ARTICLE_PATH_PARTS[0] &&
      routeParts[1] === ARTICLE_PATH_PARTS[1] &&
      isUuid(routeParts[2])
    );
  }

  function getPathParts(pathname) {
    return pathname.split("/").filter(Boolean);
  }

  function getCurrentLocale() {
    const firstPathPart = getPathParts(window.location.pathname)[0];
    return isLocaleSegment(firstPathPart) ? firstPathPart : "";
  }

  function isLocaleSegment(value) {
    return typeof value === "string" && value.length === 2 && isAsciiLetter(value[0]) && isAsciiLetter(value[1]);
  }

  function isAsciiLetter(char) {
    const code = char.charCodeAt(0);
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  }

  function isUuid(value) {
    if (typeof value !== "string") return false;

    const parts = value.split("-");
    if (parts.length !== UUID_PART_LENGTHS.length) return false;

    return parts.every((part, index) => part.length === UUID_PART_LENGTHS[index] && isHexString(part));
  }

  function isHexString(value) {
    return [...value].every(isHexChar);
  }

  function isHexChar(char) {
    const code = char.charCodeAt(0);
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
  }

  async function openArticle(url) {
    ensurePopup();
    activeRequest += 1;
    const requestId = activeRequest;

    if (abortController) abortController.abort();
    abortController = new AbortController();

    popup.hidden = false;
    popup.setAttribute("aria-busy", "true");
    openLink.href = url;
    titleNode.textContent = "MRKT article";
    bodyNode.scrollTop = 0;
    bodyNode.innerHTML = `
      <div class="mrkt-popup-state">
        <div class="mrkt-popup-spinner" aria-hidden="true"></div>
        <div>Loading article...</div>
      </div>
    `;

    try {
      const response = await fetch(url, {
        credentials: "include",
        redirect: "follow",
        signal: abortController.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      if (requestId !== activeRequest) return;

      const doc = new DOMParser().parseFromString(html, "text/html");
      const articleMain = doc.querySelector("main");

      if (!articleMain || !looksLikeArticle(articleMain)) {
        throw new Error("Article content was not found in the response.");
      }

      importRouteStyles(doc, response.url || url);
      renderArticle(articleMain, response.url || url);
      titleNode.textContent = getArticleTitle(doc, articleMain);
      popup.setAttribute("aria-busy", "false");
    } catch (error) {
      if (error && error.name === "AbortError") return;
      renderError(url, error);
      popup.setAttribute("aria-busy", "false");
    }
  }

  function looksLikeArticle(main) {
    const text = (main.textContent || "").toLowerCase();
    return text.includes("listed for") || text.includes("buy now") || main.querySelector("img[src*='tradeItem']");
  }

  function renderArticle(sourceMain, baseUrl) {
    const wrapper = document.createElement("div");
    wrapper.className = "mrkt-popup-article";

    const main = sourceMain.cloneNode(true);
    main.querySelectorAll("script, noscript, template, iframe").forEach((node) => node.remove());
    absolutizeAssets(main, baseUrl);

    main.querySelectorAll("a[href]").forEach((link) => {
      const articleUrl = toArticleUrl(link.href);
      if (!articleUrl) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });

    wrapper.appendChild(main);
    bodyNode.replaceChildren(wrapper);
  }

  function renderError(url, error) {
    titleNode.textContent = "MRKT article";
    openLink.href = url;
    bodyNode.innerHTML = `
      <div class="mrkt-popup-state mrkt-popup-error">
        <strong>Unable to load article.</strong>
        <span>${escapeHtml(error && error.message ? error.message : "Unknown error")}</span>
      </div>
    `;
  }

  function getArticleTitle(doc, main) {
    const headings = [...main.querySelectorAll("h1, h2, h3")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);

    if (headings.length >= 2) return `${headings[0]} | ${headings[1]}`;
    if (headings.length === 1) return headings[0];

    const imageAlt = main.querySelector("img[alt]")?.getAttribute("alt")?.trim();
    return imageAlt || doc.title || "MRKT article";
  }

  function importRouteStyles(doc, baseUrl) {
    const currentStyles = new Set(
      [...document.querySelectorAll("link[rel='stylesheet'][href], link[data-mrkt-popup-style][href]")].map(
        (link) => link.href
      )
    );

    doc.querySelectorAll("link[rel='stylesheet'][href]").forEach((link) => {
      const href = new URL(link.getAttribute("href"), baseUrl).href;
      if (currentStyles.has(href)) return;

      const imported = document.createElement("link");
      imported.rel = "stylesheet";
      imported.href = href;
      imported.dataset.mrktPopupStyle = "true";
      document.head.appendChild(imported);
      currentStyles.add(href);
    });
  }

  function absolutizeAssets(root, baseUrl) {
    root.querySelectorAll("[src]").forEach((node) => {
      node.setAttribute("src", new URL(node.getAttribute("src"), baseUrl).href);
    });

    root.querySelectorAll("[href]").forEach((node) => {
      node.setAttribute("href", new URL(node.getAttribute("href"), baseUrl).href);
    });

    root.querySelectorAll("[srcset]").forEach((node) => {
      const srcset = node
        .getAttribute("srcset")
        .split(",")
        .map((entry) => {
          const parts = entry.trim().split(" ").filter(Boolean);
          if (!parts[0]) return "";
          parts[0] = new URL(parts[0], baseUrl).href;
          return parts.join(" ");
        })
        .filter(Boolean)
        .join(", ");

      node.setAttribute("srcset", srcset);
    });
  }

  function ensurePopup() {
    if (popup) return;

    popup = document.createElement("section");
    popup.id = POPUP_ID;
    popup.hidden = true;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "false");
    popup.innerHTML = `
      <div class="mrkt-popup-titlebar">
        <div class="mrkt-popup-title" title="MRKT article">MRKT article</div>
        <div class="mrkt-popup-actions">
          <a class="mrkt-popup-open" href="#" target="_blank" rel="noopener noreferrer">Open</a>
          <button class="mrkt-popup-close" type="button" aria-label="Close">x</button>
        </div>
      </div>
      <div class="mrkt-popup-body"></div>
      <div class="mrkt-popup-resizer" aria-hidden="true"></div>
    `;

    document.body.appendChild(popup);

    titleNode = popup.querySelector(".mrkt-popup-title");
    bodyNode = popup.querySelector(".mrkt-popup-body");
    openLink = popup.querySelector(".mrkt-popup-open");

    popup.querySelector(".mrkt-popup-close").addEventListener("click", closePopup);
    bodyNode.addEventListener("click", handlePopupContentClick);

    restoreBounds();
    makeDraggable();
    makeResizable();
  }

  function handlePopupContentClick(event) {
    const link = event.target.closest && event.target.closest("a[href]");
    if (link) {
      const articleUrl = toArticleUrl(link.href);
      if (articleUrl) {
        event.preventDefault();
        event.stopPropagation();
        openArticle(articleUrl.href);
      }

      return;
    }
  }

  function closePopup() {
    if (!popup) return;
    popup.hidden = true;
    popup.setAttribute("aria-busy", "false");
    bodyNode.textContent = "";

    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  function restoreBounds() {
    const fallback = getFallbackBounds();
    let bounds = fallback;

    try {
      const stored = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (stored && Number.isFinite(stored.width) && Number.isFinite(stored.height)) {
        bounds = stored;
      }
    } catch {
      bounds = fallback;
    }

    applyBounds(bounds);
  }

  function getFallbackBounds() {
    const width = Math.min(980, Math.max(560, window.innerWidth - 48));
    const height = Math.min(760, Math.max(440, window.innerHeight - 48));

    return {
      left: Math.round((window.innerWidth - width) / 2),
      top: Math.max(16, Math.round((window.innerHeight - height) / 2)),
      width,
      height,
    };
  }

  function applyBounds(bounds) {
    const minWidth = Math.min(420, window.innerWidth - 16);
    const minHeight = Math.min(320, window.innerHeight - 16);
    const width = clamp(bounds.width, minWidth, Math.max(minWidth, window.innerWidth - 16));
    const height = clamp(bounds.height, minHeight, Math.max(minHeight, window.innerHeight - 16));
    const left = clamp(bounds.left, 8, Math.max(8, window.innerWidth - width - 8));
    const top = clamp(bounds.top, 8, Math.max(8, window.innerHeight - height - 8));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.width = `${width}px`;
    popup.style.height = `${height}px`;
  }

  function saveBounds() {
    const rect = popup.getBoundingClientRect();
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
    );
  }

  function makeDraggable() {
    const titlebar = popup.querySelector(".mrkt-popup-titlebar");
    let start = null;

    titlebar.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("a, button")) return;

      const rect = popup.getBoundingClientRect();
      start = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };

      titlebar.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    titlebar.addEventListener("pointermove", (event) => {
      if (!start || event.pointerId !== start.pointerId) return;

      applyBounds({
        left: start.left + event.clientX - start.x,
        top: start.top + event.clientY - start.y,
        width: start.width,
        height: start.height,
      });
    });

    titlebar.addEventListener("pointerup", endDrag);
    titlebar.addEventListener("pointercancel", endDrag);

    function endDrag(event) {
      if (!start || event.pointerId !== start.pointerId) return;
      start = null;
      saveBounds();
    }
  }

  function makeResizable() {
    const handle = popup.querySelector(".mrkt-popup-resizer");
    let start = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;

      const rect = popup.getBoundingClientRect();
      start = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };

      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!start || event.pointerId !== start.pointerId) return;

      applyBounds({
        left: start.left,
        top: start.top,
        width: start.width + event.clientX - start.x,
        height: start.height + event.clientY - start.y,
      });
    });

    handle.addEventListener("pointerup", endResize);
    handle.addEventListener("pointercancel", endResize);

    function endResize(event) {
      if (!start || event.pointerId !== start.pointerId) return;
      start = null;
      saveBounds();
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeHtml(value) {
    return [...String(value)].map((char) => HTML_ENTITIES[char] || char).join("");
  }

  function addCss() {
    const css = `
      #${POPUP_ID} {
        position: fixed;
        z-index: 2147483000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: var(--light, #e5e5ea);
        background: var(--dark, #171718);
        border: 1px solid var(--ui-border-base, #303030);
        border-radius: 8px;
        box-shadow: 0 24px 80px rgb(0 0 0 / 0.58), 0 0 0 1px rgb(255 255 255 / 0.03);
        font-family: "Space Grotesk", "Space Grotesk Fallback", sans-serif;
      }

      #${POPUP_ID}[hidden] {
        display: none !important;
      }

      #${POPUP_ID} .mrkt-popup-titlebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 42px;
        padding: 8px 10px 8px 14px;
        cursor: move;
        user-select: none;
        background: var(--ui-bg-surface, #1c1c1d);
        border-bottom: 1px solid var(--ui-border-surface, #262627);
      }

      #${POPUP_ID} .mrkt-popup-title {
        min-width: 0;
        overflow: hidden;
        color: var(--light, #e5e5ea);
        font-size: 14px;
        font-weight: 600;
        line-height: 20px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${POPUP_ID} .mrkt-popup-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: none;
      }

      #${POPUP_ID} .mrkt-popup-open,
      #${POPUP_ID} .mrkt-popup-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        min-width: 28px;
        padding: 0 10px;
        border: 1px solid var(--ui-border-surface, #262627);
        border-radius: 6px;
        color: var(--light, #e5e5ea);
        background: var(--ui-bg-surface-elevated, #1f1f1f);
        font: inherit;
        font-size: 13px;
        line-height: 1;
        text-decoration: none;
        cursor: pointer;
      }

      #${POPUP_ID} .mrkt-popup-close {
        padding: 0;
      }

      #${POPUP_ID} .mrkt-popup-open:hover,
      #${POPUP_ID} .mrkt-popup-close:hover {
        border-color: var(--brand, #fed813);
      }

      #${POPUP_ID} .mrkt-popup-body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        background:
          radial-gradient(circle at 20% 0%, rgb(254 216 19 / 0.05), transparent 260px),
          var(--dark, #171718);
      }

      #${POPUP_ID} .mrkt-popup-state {
        display: grid;
        min-height: 100%;
        place-content: center;
        gap: 12px;
        padding: 32px;
        color: var(--gray-secondary, #a8a8ac);
        text-align: center;
      }

      #${POPUP_ID} .mrkt-popup-error strong {
        color: var(--light, #e5e5ea);
      }

      #${POPUP_ID} .mrkt-popup-spinner {
        width: 28px;
        height: 28px;
        margin: 0 auto;
        border: 2px solid rgb(255 255 255 / 0.14);
        border-top-color: var(--brand, #fed813);
        border-radius: 999px;
        animation: mrkt-popup-spin 800ms linear infinite;
      }

      #${POPUP_ID} .mrkt-popup-resizer {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 18px;
        height: 18px;
        cursor: nwse-resize;
      }

      #${POPUP_ID} .mrkt-popup-resizer::after {
        position: absolute;
        right: 4px;
        bottom: 4px;
        width: 8px;
        height: 8px;
        border-right: 2px solid var(--ui-bg-active, #555);
        border-bottom: 2px solid var(--ui-bg-active, #555);
        content: "";
      }

      #${POPUP_ID} .mrkt-popup-article {
        min-width: 720px;
      }

      #${POPUP_ID} .mrkt-popup-article > main {
        min-height: 0 !important;
        padding-top: 0 !important;
        margin-left: 0 !important;
      }

      #${POPUP_ID} .mrkt-popup-article > main > div:first-child {
        min-height: 0 !important;
        height: auto !important;
        padding: 16px !important;
        overflow: visible !important;
      }

      #${POPUP_ID} .mrkt-popup-article .fixed {
        position: static !important;
      }

      #${POPUP_ID} .mrkt-popup-article img {
        max-width: 100%;
      }

      #${POPUP_ID} .mrkt-popup-article button {
        cursor: pointer;
      }

      @keyframes mrkt-popup-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 720px) {
        #${POPUP_ID} {
          left: 8px !important;
          top: 8px !important;
          width: calc(100vw - 16px) !important;
          height: calc(100vh - 16px) !important;
          border-radius: 8px;
        }

        #${POPUP_ID} .mrkt-popup-titlebar {
          min-height: 46px;
        }

        #${POPUP_ID} .mrkt-popup-article {
          min-width: 0;
        }
      }
    `;

    if (typeof GM_addStyle === "function") {
      GM_addStyle(css);
    } else {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
    }
  }
})();
