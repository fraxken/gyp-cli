#!/usr/bin/env node
require("make-promises-safe");

// Node.js Dependencies
const { existsSync } = require("fs");
const { readFile, writeFile, readdir, stat, access } = require("fs").promises;
const { join, extname, relative } = require("path");

// Third-party Dependencies
const commander = require("commander");
const { gray, green, red } = require("kleur");
const ora = require("ora");

// CONSTANTS
const C_EXT = new Set([".c", ".cc", ".cpp"]);
const EXCLUDE_PATH = new Set(["node_modules", ".git"]);
const CWD = process.cwd();

/**
 * @async
 * @func searchTree
 * @param {!String} dir directory
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

/**
 * @async
 * @func init
 * @returns {Promise<void>}
 */
async function init() {
    const bindingExist = existsSync(join(CWD, "binding.gyp"));
    if (bindingExist) {
        console.log(red("Unable to initialize, binding.gyp already exist!"));
        process.exit(0);
    }

    let target_name = "binding";
    let hasNodeAddonApi = false;
    let hasNAN = false;
    let hasIncludeDir = false;

    // Retrieve information from package.json
    const spinPkg = ora("Parsing local package.json...").start();
    try {
        const str = await readFile(join(CWD, "package.json"), { encoding: "utf8" });
        const pkg = JSON.parse(str);
        target_name = pkg.name;

        const dependencies = pkg.dependencies || {};
        hasNodeAddonApi = Reflect.has(dependencies, "node-addon-api");
        hasNAN = Reflect.has(dependencies, "nan");
        spinPkg.succeed();
    }
    catch (err) {
        // do nothing
        spinPkg.fail();
    }

    // Detect if we have a root ./include directory
    const spinInclude = ora("/include dir exist").start();
    try {
        await access(join(CWD, "include"));
        hasIncludeDir = true;
        spinInclude.succeed();
    }
    catch (err) {
        // do nothing
        spinInclude.fail();
    }

    // C & C++ source files!
    const spinSources = ora("Search for .cc and .cpp files in the local tree...").start();
    const sources = (await searchTree(CWD)).map((file) => relative(CWD, file));
    spinSources.succeed();

    const include_dirs = [];
    const bindings = { targets: [] };
    const target = {
        target_name,
        sources,
        include_dirs
    };

    if (hasIncludeDir) {
        include_dirs.push("include");
    }
    if (hasNodeAddonApi) {
        include_dirs.push("<!@(node -p \"require('node-addon-api').include\")");
        Reflect.set(target, "dependencies", ["<!(node -p \"require('node-addon-api').gyp\")"]);
    }
    if (hasNAN) {
        include_dirs.push("<!(node -e \"require('nan')\")");
    }
    bindings.targets.push(target);

    await writeFile(join(CWD, "binding.gyp"), JSON.stringify(bindings, null, 4));
    console.log(green("\n Successfully initialized binding.gyp"));
}

async function update() {
    // do things!
}

/**
 * @async
 * @func main
 * @returns {Promise<void>}
 */
async function main() {
    const argv = commander
        .version("1.0.0")
        .option("-i, --init", "initialize gyp file")
        .option("-u, --update", "update binding.gyp file")
        .parse(process.argv);

    const initBindingGyp = Boolean(argv.init);
    const updateBindingGyp = Boolean(argv.update);
    if (initBindingGyp) {
        console.log(gray("\n > Initializing binding.gyp\n"));
        await init();

        return;
    }
}
main().catch(console.error);
