import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../popup/local.js',import.meta.url),'utf8');
const context=vm.createContext({});
for(const name of ['orderedHosts','orderedNames','moveItem']) {
 const start=source.indexOf(`function ${name}(`);
 vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),context);
}
const evaluate=code=>JSON.parse(JSON.stringify(vm.runInContext(code,context)));
test('moves before and after target without mutating the original list',()=>{
 assert.deepEqual(evaluate("moveItem(['a','b','c'],'c','a')"),['c','a','b']);
 assert.deepEqual(evaluate("moveItem(['a','b','c'],'a','c',true)"),['b','c','a']);
});
test('saved order wins, deleted entries disappear and new entries remain available',()=>{
 vm.runInContext("profiles={'a.com':{},'b.com':{},'c.com':{}}; profileOrder={sites:['b.com','deleted.com'],accounts:{'a.com':['B','deleted']}}",context);
 assert.deepEqual(evaluate('orderedHosts()'),['b.com','a.com','c.com']);
 assert.deepEqual(evaluate("orderedNames('a.com',{A:{timestamp:3},B:{timestamp:1},C:{timestamp:2}})"),['B','A','C']);
});