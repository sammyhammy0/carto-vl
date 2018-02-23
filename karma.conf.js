module.exports = function (config) {
    config.set({
        frameworks: ['jasmine'],
        files: ['test/unit/index.test.js'],
        exclude: ['test/integration/**'],
        reporters: ['mocha'],
        port: 9876,  // karma web server port
        colors: true,
        logLevel: config.LOG_INFO,
        browsers: ['ChromeHeadlessNoSandbox'],
        autoWatch: false,
        singleRun: false,
        concurrency: Infinity,
        preprocessors: {
            'test/unit/index.test.js': ['webpack', 'sourcemap'],
        },
        webpack: {
            devtool: 'inline-source-map'
        },
        customLaunchers: {
            // Add no-sandbox flag due a bug. https://github.com/karma-runner/karma-chrome-launcher/issues/158
            ChromeHeadlessNoSandbox: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox']
            }
        },
    });
};
