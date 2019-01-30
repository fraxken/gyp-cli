#!/usr/bin/env node
require("make-promises-safe");

// Node.js Dependencies
const { existsSync } = require("fs");
const { readFile, writeFile, readdir, stat, access } = require("fs").promises;
const { join, extname, relative } = require("path");

// Third-party Dependencies
const commander = require("commander");
const { gray, green, yellow, red } = require("kleur");
const ora = require("ora");
const diff = require("json-diff");

// Internal
let localConfig;

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
    const target = { target_name, sources, include_dirs };

    if (hasIncludeDir) {
        include_dirs.push("include");
    }
    if (hasNodeAddonApi) {
        include_dirs.push("<!@(node -p \"require('node-addon-api').include\")");
        target.dependencies = ["<!(node -p \"require('node-addon-api').gyp\")"];
    }
    if (hasNAN) {
        include_dirs.push("<!(node -e \"require('nan')\")");
    }
    if (include_dirs.length === 0) {
        delete target.include_dirs;
    }
    bindings.targets.push(target);

    await writeFile(join(CWD, "binding.gyp"), JSON.stringify(bindings, null, 4));
    console.log(gray("\n binding.gyp"));
    console.log(gray(diff.diffString({}, bindings)));
    console.log("");
}

/**
 * @async
 * @func update
 * @returns {Promise<void>}
 */
async function update() {
    if (!existsSync(join(CWD, "binding.gyp"))) {
        console.log(red("Unable to found binding.gyp, can't to trigger update!"));
        process.exit(0);
    }

    const gypStr = await readFile(join(CWD, "binding.gyp"), { encoding: "utf8" });
    const bindings = JSON.parse(gypStr);
    let hasNodeAddonApi = false;
    let hasNAN = false;

    // Retrieve information from package.json
    const spinPkg = ora("Parsing local package.json...").start();
    try {
        const str = await readFile(join(CWD, "package.json"), { encoding: "utf8" });
        const pkg = JSON.parse(str);

        const dependencies = pkg.dependencies || {};
        hasNodeAddonApi = Reflect.has(dependencies, "node-addon-api");
        hasNAN = Reflect.has(dependencies, "nan");
        spinPkg.succeed();
    }
    catch (err) {
        // do nothing
        spinPkg.fail();
    }

    // C & C++ source files!
    const spinSources = ora("Search for .cc and .cpp files in the local tree...").start();
    const sources = (await searchTree(CWD)).map((file) => relative(CWD, file));
    spinSources.succeed();
    // TODO: Check for sources files ?
}

/**
 * @async
 * @func main
 * @returns {Promise<void>}
 */
async function main() {
    const configPath = join(__dirname, "..", "src", "config.json");
    if (existsSync(configPath)) {
        const buf = await readFile(configPath);
        localConfig = JSON.parse(buf.toString());
    }
    else {
        localConfig = {};
        await writeFile(configPath, JSON.stringify(localConfig, null, 4));
    }

    const argv = commander
        .version("1.0.0")
        .option("-i, --init", "initialize gyp file")
        .option("-u, --update", "update binding.gyp file")
        .option("-s, --set <key>")
        .parse(process.argv);

    // Retrieve argv
    const initBindingGyp = Boolean(argv.init);
    const updateBindingGyp = Boolean(argv.update);
    const setKey = typeof argv.set === "string";

    if (setKey) {
        const [key, value] = argv.set.split("=");
        localConfig[key] = value;
        console.log(gray(`\n > Set new config key "${yellow(key)}" with value: ${yellow(value)}\n`));
        await writeFile(configPath, JSON.stringify(localConfig, null, 4));

        return;
    }

    if (initBindingGyp) {
        console.log(gray("\n > Generate binding.gyp\n"));
        await init();

        return;
    }

    if (updateBindingGyp) {
        console.log(gray("\n > Updating binding.gyp\n"));
        await update();

        return;
    }
}
main().catch(console.error);
