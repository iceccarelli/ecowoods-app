import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: {
    compilerOptions: {
      jsx: 'react-jsx'
    }
  },
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom'],
  target: 'es2022',
})
