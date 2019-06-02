# gyp-cli
![ver](https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/fraxken/gyp-cli/master/package.json&query=$.version&label=Version)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/SlimIO/is/commit-activity)
![MIT](https://img.shields.io/github/license/mashape/apistatus.svg)
![dep](https://img.shields.io/david/fraxken/gyp-cli.svg)
![size](https://img.shields.io/github/languages/code-size/fraxken/gyp-cli.svg)

npm CLI to create and manage .gyp files

## Features

- Initialize **binding.gyp** file for you.
- Search all `.cc` and `.cpp` files in the local tree.
- Auto include both `nan` and `node-addon-api`.

## Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm](https://docs.npmjs.com/getting-started/what-is-npm) or [yarn](https://yarnpkg.com).

```bash
$ npm i gyp-cli
# or
$ yarn add gyp-cli
# or
```

## Usage example
When installed globally the `gyp` executable will be exposed in your terminal.
```bash
$ gyp --help
$ gyp --init
```

## Arguments

| argument | shortcut | description |
| --- | --- | --- |
| --init | -i | Initialize binding.gyp file |
| --update | -u | Update binding.gyp file |

> Note: only one argument at a time can be triggered!

## Licence
MIT
