const ts = require('../web/node_modules/typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context = {exports:{}};
  vm.runInNewContext(code,context);
  return context.exports;
}
const v = load('web/src/lib/validation.ts');
for (const bad of ['', '-1','NaN','Infinity','1.001','1e3','10000000000',0,null]) assert.throws(()=>v.requireMoney(bad,'amount'));
for (const good of ['1','0.01','9999999999.99']) v.requireMoney(good,'amount');
assert.throws(()=>v.requireMoney('0','amount'));
v.requireMoney('0','amount',true);
for (const bad of ['2026-02-30','bad','2026-13-01',null]) assert.equal(v.isDate(bad),false);
assert.equal(v.isDate('2024-02-29'),true);
assert.throws(()=>v.requireUuid('-'.repeat(36),'id'));
v.requireUuid('00000000-0000-0000-0000-0000000000a5','id');
const sql = load('web/src/lib/ai/sqlGuard.ts');
for (const bad of ['delete from batch_pnl','select * from party','select pg_sleep(10) from batch_pnl','select * from batch_pnl; drop table party','select * from batch_pnl -- bypass','select * from batch_pnl limit 1001']) assert.equal(sql.validateSqlStatic(bad).ok,false,bad);
assert.equal(sql.validateSqlStatic('select sum(net_profit) from batch_pnl').ok,true);
console.log('Validation and SQL guard regressions passed.');
