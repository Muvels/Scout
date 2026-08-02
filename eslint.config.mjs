import tbf from '@tbf/eslint-plugin';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // .tbf-dev holds generated output: the esbuild main bundle and a browser
  // profile. Without it here, the first `tbf dev` makes `npm run lint`
  // fail on bundled third-party code. extensions/ holds vendored upstream
  // extension code (uBlock Origin) that is shipped as-is, not authored here.
  { ignores: ['dist/**', 'node_modules/**', '.tbf-dev/**', 'extensions/**'] },
  ...tseslint.configs.recommended,
  tbf.configs.recommended,
);
