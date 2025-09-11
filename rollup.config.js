import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import css from "rollup-plugin-css-only";
import terser from "@rollup/plugin-terser";

export default [
    {
        input: "src/main.js",
        external: ["Gooey"],
        output: [
            {
                file: "dist/hebe.esm.js",
                format: "esm",
                sourcemap: true,
            },
            {
                file: "dist/hebe.js",
                format: "iife",
                name: "Tyme",
                sourcemap: true,
            },
        ],
        plugins: [
            resolve(),
            commonjs(),
            css({ output: "bundle.css" }),
            terser(),
        ],
    },
];
