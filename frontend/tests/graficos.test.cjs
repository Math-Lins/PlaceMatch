const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Executa os componentes reais sem DOM ou dependência adicional de testes.
const source = fs.readFileSync('src/admin/graficos.tsx', 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
});
const exportsObject = {};
vm.runInNewContext(outputText, {
  exports: exportsObject,
  require: name => name === '../ui'
    ? { C: {}, diaMesBR: v => v, numeroBR: String }
    : require(name),
});
function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)];
}

test('eixo de contagens pequenas não repete ticks/chaves', () => {
  for (const max of [1, 2, 10, 100]) {
    const chart = exportsObject.LineAreaChart({
      title: 'Teste', series: [{ data: '2026-01-01', matches: max, curtidas: 0, mensagens: 0 }],
    });
    const ticks = nodes(chart).filter(n => n.type === 'g' && nodes(n).some(c => c.type === 'line'));
    assert.equal(new Set(ticks.map(n => n.key)).size, ticks.length);
  }
});

test('barras horizontais representam zero sem largura positiva', () => {
  for (const perfis of [0, 2]) {
    const chart = exportsObject.HorizontalBars({
      title: 'Teste', data: [{ regiao: 'Recife', perfis, matches: 0, score_medio: null }],
    });
    const bars = nodes(chart).filter(n => n.type === 'rect' && n.props.height === 10 && n.props.x === 110);
    assert.equal(bars[0].props.width > 0, perfis > 0);
    assert.equal(bars[1].props.width, 0);
  }
});

test('distribuição representa zero sem altura positiva', () => {
  for (const total of [0, 2]) {
    const chart = exportsObject.ScoreDistChart({
      title: 'Teste', data: [{ faixa: 'zero', total: 0 }, { faixa: 'outra', total }],
    });
    const bars = nodes(chart).filter(n => n.type === 'rect');
    assert.equal(bars[0].props.height, 0);
    assert.equal(bars[1].props.height > 0, total > 0);
  }
});
