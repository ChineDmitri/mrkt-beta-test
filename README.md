# MRKT.land Beta Tests

[![Lint](https://github.com/ChineDmitri/mrkt-beta-test/actions/workflows/lint.yml/badge.svg)](https://github.com/ChineDmitri/mrkt-beta-test/actions/workflows/lint.yml)

This repository is for beta-test proposals, small prototypes, and bug reports for the MRKT.land platform.

The first proposal is `1-pop-up`: a Tampermonkey userscript that opens CS2 skin article pages in an in-page desktop-style popup instead of creating many browser tabs.

Future folders can contain separate proposals, experiments, or bug reports. Keep each topic isolated in its own directory so it can be reviewed and tested independently.

## Development

Install dependencies:

```sh
npm install
```

Run the linter and syntax check:

```sh
npm run ci
```

Run only ESLint:

```sh
npm run lint
```
