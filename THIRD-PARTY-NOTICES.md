# Third-party notices

General UI icons: Tabler Icons / @tabler/icons-react, MIT License.
https://github.com/tabler/tabler-icons

Specialized flat, single-slope, gable and carport symbols are project-specific drawings following the same 24 × 24 / 2px outline convention.

## Tabler Icons license

MIT License

Copyright (c) 2020-2026 Paweł Kuna

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## GeoNames city reference coordinates

`src/city-presets.json`: 50 Chinese city reference points taken from GeoNames cities15000 (2026-09-30), keeping the geonameId. Cities with the same name were checked by Chinese name and province. Source: https://download.geonames.org/export/dump/ . License CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ . Coordinates are rounded to 4 decimals and are not project site coordinates.

## Fonts

Inter and Noto Sans SC use the SIL Open Font License. See [Inter](docs/font-licenses/Inter-OFL.txt) and [Noto Sans SC](docs/font-licenses/Noto-Sans-SC-OFL.txt).

## PDF rendering

PDF.js is provided by the pdfjs-dist dependency under Apache-2.0. The build copies CMaps, standard fonts and WebAssembly from the installed package, including their accompanying license files. See https://github.com/mozilla/pdf.js .

## Environment texture

The HDR texture used in the 3D viewport is distributed by Poly Haven under CC0. See [source details](public/textures/README.md).

## Additional browser dependency licenses

The production build includes the installed dependency license texts in `third-party-licenses/`. The React Three Fiber npm package declares MIT but omits the full file. Its upstream license is provided [here](docs/third-party-licenses/react-three-fiber-MIT.txt), from the source commit for v9.7.0.
