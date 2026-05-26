const { getDefaultConfig } = require('expo/metro/config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../../packages')];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@ecowoods': path.resolve(__dirname, '../../packages'),
};
module.exports = config;
