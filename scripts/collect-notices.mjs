import {cp, mkdir} from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const licenses = new URL('third-party-licenses/', dist);
await mkdir(licenses, {recursive: true});
for (const file of ['LICENSE.md', 'LICENSE.zh-CN.md', 'THIRD-PARTY-NOTICES.md']) {
  await cp(new URL('../' + file, import.meta.url), new URL(file, dist));
}
for (const folder of ['font-licenses', 'third-party-licenses']) {
  await cp(new URL('../docs/' + folder + '/', import.meta.url), new URL('docs/' + folder + '/', dist), {recursive: true});
}

const packages = [
  '@babel/runtime', '@tabler/icons', '@tabler/icons-react', 'base64-js',
  'buffer', 'ieee754', 'its-fine', 'pdfjs-dist', 'react', 'react-dom',
  'react-use-measure', 'scheduler', 'suspend-react', 'three',
  'use-sync-external-store', 'zustand',
];
for (const name of packages) {
  const source = new URL(`../node_modules/${name}/LICENSE`, import.meta.url);
  await cp(source, new URL(name.replace('/', '-') + '.txt', licenses));
}
