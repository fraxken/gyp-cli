"use strict";

// Node.js Dependencies
const { readdir, stat } = require("fs").promises;
const { join, extname } = require("path");

/**
 * @namespace utils
 */

// CONSTANTS
const C_EXT = new Set([".c", ".cc", ".cpp"]);
const EXCLUDE_PATH = new Set(["node_modules", ".git"]);

/**
 * @async
 * @function searchTree
 * @memberof utils#
 * @param {!string} dir directory
 * @returns {Promise<void>}
 */
async function searchTree(dir) {
    const list = await readdir(dir);
    const lstats = await Promise.all(list.map((fd) => stat(join(dir, fd))));
    const ret = [];
    const dirs = [];

    for (let id = 0; id < list.length; id++) {
        const fd = list[id];
        if (EXCLUDE_PATH.has(fd)) {
            continue;
        }
        if (C_EXT.has(extname(fd))) {
            ret.push(join(dir, fd));
            continue;
        }
        if (lstats[id].isDirectory()) {
            dirs.push(fd);
        }
    }
    const subRet = await Promise.all(
        dirs.map((sDir) => searchTree(join(dir, sDir)))
    );

    return Object.assign(ret, ...subRet);
}

module.exports = { searchTree };
