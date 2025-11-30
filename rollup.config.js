import typescript from '@rollup/plugin-typescript';
import { readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get all TypeScript files from src directory
function getSourceFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  files.forEach(file => {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      getSourceFiles(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const sourceFiles = getSourceFiles(join(__dirname, 'src'));

// Create a rollup config for each source file
const configs = sourceFiles.flatMap(file => {
  const relativePath = file.replace(join(__dirname, 'src'), '').replace(/\\/g, '/');
  const fileName = basename(file, extname(file));
  const outputDir = join(__dirname, 'dist', dirname(relativePath));

  return [
    // ESM build
    {
      input: file,
      output: {
        file: join(outputDir, `${fileName}.js`),
        format: 'es',
        sourcemap: true,
        preserveModules: false, // Bundle for better tree shaking
      },
      plugins: [
        typescript({
          tsconfig: './tsconfig.json',
          declaration: false,
          declarationMap: false,
        }),
      ],
      external: [], // No external dependencies for now
      onwarn(warning, warn) {
        // Suppress empty chunk warnings for files that only export types/interfaces
        if (warning.code === 'EMPTY_BUNDLE') {
          return;
        }
        warn(warning);
      },
    },
    // CJS build
    {
      input: file,
      output: {
        file: join(outputDir, `${fileName}.cjs`),
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      plugins: [
        typescript({
          tsconfig: './tsconfig.json',
          declaration: false,
          declarationMap: false,
        }),
      ],
      external: [],
      onwarn(warning, warn) {
        // Suppress empty chunk warnings for files that only export types/interfaces
        if (warning.code === 'EMPTY_BUNDLE') {
          return;
        }
        warn(warning);
      },
    },
  ];
});

export default configs;

