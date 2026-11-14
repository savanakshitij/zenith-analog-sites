// node stability.js <engine dir> <out.json>: share of 200 random weightings in which each cell is in the top 1% (v1.6 definition).
const fs=require('fs'),path=require('path');const dir=process.argv[2];
const Z=require(path.resolve(dir,'zenith-engine.js'));const b=fs.readFileSync(path.join(dir,'earth_cells.bin'));
const e=new Z.Engine(JSON.parse(fs.readFileSync(path.join(dir,'engine_params.json'))),b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
let seed=20261114;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return (seed+0.5)/4294967296;};
const DIMS=e.params.dims,out={};
for(const T of e.targets){
  const cols=DIMS.map(d=>{const w={};DIMS.forEach(x=>w[x]=x===d?1:0);return e.scoreAll(T.id,{weights:w});});
  const idx=[];for(let i=0;i<e.n;i++)if(cols[0][i]===cols[0][i])idx.push(i);
  const n=idx.length,k=Math.max(50,Math.round(0.01*n)),L=cols.map(c=>Float32Array.from(idx,i=>Math.log(Math.max(c[i],e.params.floor))));
  const cnt=new Uint16Array(n),s=new Float32Array(n),ord=new Uint32Array(n);
  for(let r=0;r<200;r++){const w=DIMS.map(()=>-Math.log(rnd()));const sum=w.reduce((a,c)=>a+c,0);
    for(let j=0;j<n;j++){let v=0;for(let d=0;d<DIMS.length;d++)v+=w[d]/sum*L[d][j];s[j]=v;ord[j]=j;}
    const srt=Float32Array.from(s).sort();const thr=srt[n-k];for(let j=0;j<n;j++)if(s[j]>=thr)cnt[j]++;}
  const m={};for(let j=0;j<n;j++)if(cnt[j])m[idx[j]]=cnt[j];out[T.id]=m;console.log(T.id,n,Object.keys(m).length);
}
fs.writeFileSync(process.argv[3],JSON.stringify(out));
