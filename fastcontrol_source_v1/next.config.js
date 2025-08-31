/** @type {import('next').NextConfig} */
const withSvgr = require('next-plugin-svgr');

const nextConfig = withSvgr({
    reactStrictMode: false,
    poweredByHeader: false,
    webpack: (config) => {
        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            'react-dnd-html5-backend$': require('path').resolve(__dirname, 'node_modules/react-dnd-html5-backend/dist/cjs/index.js'),
            'react-dnd-html5-backend/dist/esm': require('path').resolve(__dirname, 'node_modules/react-dnd-html5-backend/dist/cjs'),
        };
        return config;
    },
});

module.exports = nextConfig;
