// Lays out the six views tools/blender/lineup.py renders in `sheet` mode on one page, labelled like Brian's turnaround
// sheets, and screenshots it.   node tools/blender/sheet.mjs <prefix> <out.png> [title]
//   (<prefix>-front.png, -back.png, -left.png, -right.png, -top.png, -bottom.png must exist)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [prefix, out, title = ''] = process.argv.slice(2);
const views = ['front', 'back', 'left', 'right', 'top', 'bottom'];
const img = (v) => `data:image/png;base64,${readFileSync(`${prefix}-${v}.png`).toString('base64')}`;
const html = `<body style="margin:0;background:#EDEDEA;font:600 22px monospace;color:#333">
<div style="text-align:center;padding:10px">${title}</div>
<div style="display:grid;grid-template-columns:repeat(3,420px);gap:6px;justify-content:center">
${views.map((v) => `<figure style="margin:0;text-align:center"><img src="${img(v)}" style="width:420px;height:420px"><figcaption>${v.toUpperCase()}</figcaption></figure>`).join('')}
</div></body>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1300, height: 960 } });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log(out);
