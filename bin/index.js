#!/usr/bin/env node
"use strict";

require("make-promises-safe");

// Node.js Dependencies
const { existsSync } = require("fs");
const { readFile, writeFile, access } = require("fs").promises;
const { join, relative } = require("path");

// Third-party Dependencies
const commander = require("commander");
const { gray, yellow, red, white, cyan } = require("kleur");
const ora = require("ora");
const diff = require("json-diff");
const cacache = require("cacache");

// Require Internal Dependencies
const { searchTree } = require("../src/utils");

// CONSTANTS
const CWD = process.cwd();
const CACHE_PATH = "/tmp/gyp-cli";

/**
 * @async
 * @function init
 * @returns {Promise<void>}
 */
async function init() {
    const bindingExist = existsSync(join(CWD, "binding.gyp"));
    if (bindingExist) {
        console.log(red().bold("Unable to initialize, binding.gyp already exist!"));
        process.exit(0);
    }

    let target_name = "binding";
    let hasNodeAddonApi = false;
    let hasNAN = false;
    let hasIncludeDir = false;

    // Retrieve information from package.json
    const spinPkg = ora(white().bold("Parsing local package.json...")).start();
    try {
        const str = await readFile(join(CWD, "package.json"), { encoding: "utf8" });
        const { name, dependencies = {} } = JSON.parse(str);
        target_name = name;

        hasNodeAddonApi = Reflect.has(dependencies, "node-addon-api");
        hasNAN = Reflect.has(dependencies, "nan");
        spinPkg.succeed();
    }
    catch (err) {
        // do nothing
        spinPkg.fail();
    }

    // Detect if we have a root ./include directory
    const spinInclude = ora(white().bold("/include dir exist")).start();
    try {
        await access(join(CWD, "include"));
        hasIncludeDir = true;
        spinInclude.succeed();
    }
    catch (err) {
        spinInclude.fail();
    }

    // C & C++ source files!
    const spinSources = ora(
        white().bold(`Search for ${yellow().bold(".cc")} and ${yellow().bold(".cpp")} files in the local tree...`)
    ).start();
    const sources = (await searchTree(CWD)).map((file) => relative(CWD, file));
    spinSources.succeed();

    const include_dirs = [];
    const bindings = { targets: [] };
    const target = {
        target_name,
        sources,
        include_dirs,
        defines: ["NAPI_DISABLE_CPP_EXCEPTIONS"],
        "cflags!": ["-fno-exceptions"],
        "cflags_cc!": ["-fno-exceptions"],
        msvs_settings: {
            VCCLCompilerTool: {
                ExceptionHandling: 1
            }
        }
    };

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
    console.log(gray().bold("\n binding.gyp"));
    console.log(gray().bold(diff.diffString({}, bindings)));
    console.log("");
}

/**
 * @async
 * @function update
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
 * @function main
 * @returns {Promise<void>}
 */
async function main() {
    const argv = commander
        .version("1.0.0")
        .option("-i, --init", "initialize gyp file")
        .option("-u, --update", "update binding.gyp file")
        .option("-s, --set <key>")
        .option("-g, --get <key>")
        .parse(process.argv);

    if (typeof argv.set === "string") {
        const [key, value] = argv.set.split("=");
        console.log(cyan().bold(`\n > Set new config key "${yellow().bold(key)}" with value: ${yellow().bold(value)}\n`));
        await cacache.put(CACHE_PATH, key, value);
    }

    else if (typeof argv.get === "string") {
        try {
            const value = (await cacache.get(CACHE_PATH, argv.get)).data.toString();
            console.log(value);
            console.log(white().bold(`\n> Requested key '${yellow().bold(argv.get)}' has value => ${cyan().bold(value)}`));
        }
        catch (err) {
            console.log(red().bold(`\n> Requested key '${yellow().bold(argv.get)}' not found in the local cache!`));
        }
    }

    else if (argv.init) {
        console.log(cyan().bold("\n > Generate binding.gyp\n"));
        await init();
    }

    else if (argv.update) {
        console.log(cyan().bold("\n > Updating binding.gyp\n"));
        await update();
    }
}
main().catch(console.error);
