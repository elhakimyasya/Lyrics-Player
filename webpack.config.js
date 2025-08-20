const path = require('path');
const terserWebpackPlugin = require('terser-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: {
        'script': './src/scripts/script.js',
        'background': './src/scripts/background.js',
    },
    output: {
        clean: false,
        path: path.resolve(__dirname, './dist/scripts'),
        filename: '[name].min.js',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                [
                                    '@babel/preset-env',
                                    {
                                        targets: '> 0.25%, not dead',
                                    },
                                ],
                            ],
                            plugins: [
                                // your plugins here
                            ],
                            // add the terserOptions here
                            compact: true,
                            comments: false
                        }
                    }
                ]
            }
        ]
    },
    optimization: {
        minimize: true,
        minimizer: [
            new terserWebpackPlugin({
                extractComments: false,
                terserOptions: {
                    compress: true,
                    format: {
                        comments: false,
                    },
                    mangle: true,
                },
            })
        ]
    },
    plugins: [
    ],
    // devtool: 'source-map',
    watch: false
}