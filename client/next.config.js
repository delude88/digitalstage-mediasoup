module.exports = {
    webpack: (config, {isServer}) => {
        config.plugins = config.plugins || [];

        // Fixes npm packages that depend on `fs` module
        if (!isServer) {
            config.node = {
                fs: "empty"
            };
        }
        config.externals = config.externals || {};
        config.externals['styletron-server'] = 'styletron-server';
        return config;
    }
};
