import {afterEach,describe,expect,it,vi} from 'vitest';
import {safeNext} from './account';

afterEach(()=>{
 vi.unstubAllGlobals();
 vi.resetModules();
});

describe('safeNext',()=>{
 it('returns to a page on this site',()=>{
  expect(safeNext('?next=%2F')).toBe('/');
  expect(safeNext('?next=%2Fai-design.html%3Fx%3D1')).toBe('/ai-design.html?x=1');
 });
 it('never leaves the site or loops back to login',()=>{
  for(const next of ['https://evil.example','//evil.example','/\\evil.example','/login.html','/login.html?next=/','javascript:alert(1)',''])expect(safeNext('?next='+encodeURIComponent(next))).toBe('/');
  expect(safeNext('')).toBe('/');
 });
});

describe('loadAccount',()=>{
 it('skips /api/auth/me in core edition',async()=>{
  vi.resetModules();
  const fetchSpy=vi.fn();
  vi.stubGlobal('document',{documentElement:{dataset:{edition:'core'},lang:'zh-CN'},getElementById:()=>null});
  vi.stubGlobal('fetch',fetchSpy);
  const {loadAccount}=await import('./account');
  expect(await loadAccount()).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
 });
});
