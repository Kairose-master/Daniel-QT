module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/reanimated 는 이 플러그인이 반드시 마지막에 있어야 합니다.
    // (expo-router 가 reanimated 를 요구하므로 필수)
    plugins: ['react-native-worklets/plugin'],
  };
};
