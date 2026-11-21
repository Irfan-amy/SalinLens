import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

// Two targets from one source (bundle name defaults to [name].[platform].bundle):
//  - lynx: the real Android bundle, dist/main.lynx.bundle (Gradle copies it into the APK)
//  - web:  a browser build, dist/main.web.bundle, used by the web preview/tests (no emulator)
export default defineConfig({
  plugins: [pluginReactLynx()],
  environments: { lynx: {}, web: {} },
  output: { minify: true },
});
