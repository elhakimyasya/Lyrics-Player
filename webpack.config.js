const path = require('path');
const fs = require('fs');
const terserWebpackPlugin = require('terser-webpack-plugin');

// 1. Fungsi untuk membaca dan membuat objek entry secara otomatis
const generateEntries = () => {
    const scriptsDirectory = path.resolve(__dirname, 'src/scripts');
    const entries = {};

    // Cek apakah foldernya ada
    if (fs.existsSync(scriptsDirectory)) {
        const files = fs.readdirSync(scriptsDirectory);

        files.forEach((file) => {
            // Hanya ambil file berformat .js
            if (path.extname(file) === '.js') {
                const entryName = path.basename(file, '.js'); // Nama file tanpa ekstensi (contoh: 'script')
                entries[entryName] = path.join(scriptsDirectory, file);
            }
        });
    }

    return entries;
};

module.exports = {
    mode: 'production',

    // 2. Terapkan fungsi auto entry di sini
    entry: generateEntries(),

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
    plugins: [],
    watch: false
};