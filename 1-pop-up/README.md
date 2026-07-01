# Proposal 1: CS2 Item Popup

This proposal adds a Tampermonkey userscript for MRKT.land CS2 item pages.

The goal is to keep browsing inside the catalog page. When a user clicks a CS2 item, the userscript opens the item page in an in-page desktop-style popup instead of navigating to a new browser tab.

## What It Changes

- Intercepts clicks on CS2 item links.
- Loads the item page content inside a draggable and resizable popup.
- Keeps the MRKT.land dark visual theme.
- Allows closing the popup with the `x` button or the `Escape` key.
- Keeps a direct `Open` link for opening the original item page when needed.

## How To Test

1. Install the Tampermonkey browser extension.
2. Create a new userscript in Tampermonkey.
3. Paste the content of [user-scipt.js](user-scipt.js).
4. Save and enable the userscript.
5. Open `https://www.mrkt.land/en/skins/cs2`.
6. Click any CS2 item card.

Expected result: the item opens in a popup inside the same page, and the browser does not create a new tab for every item click.
