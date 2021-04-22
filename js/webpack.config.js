const path = require('path');

module.exports = {
    entry: "./src/main.ts",
    mode: "development",
    entry: {
        "gotty": "./src/main.ts",
        "spice": "./spice-web-client/run.js",
    },
    output: {
        path: path.resolve(__dirname, '../bindata/static/js/'),
    },
    devtool: "source-map",
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader",
                exclude: /node_modules/
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.js$/,
                include: /node_modules/,
                loader: 'license-loader'
            },
        ],
    },
};
