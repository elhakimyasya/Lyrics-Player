module.exports = {
    plugins: {
        'postcss-discard-comments': {
            removeAll: true, // This option removes all comments
        },
        "@tailwindcss/postcss": {
            optimize: { minify: true }
        },
    },
};
