#!/usr/bin/env node
import { runCli } from "./program.js";

const code = await runCli(process.argv.slice(2));
process.exitCode = code;
