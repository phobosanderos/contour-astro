// Generate compact social preview from the existing PNG without modifying source artwork.
// Pure Node PNG decoder/encoder: avoids additional image-processing dependencies.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const source = path.resolve('public/img/og-home-v2.png');
const destination = path.resolve('public/img/og-home-v3.png');
const file = fs.readFileSync(source);
const sig = Buffer.from([137,80,78,71,13,10,26,10]);
if (!file.subarray(0,8).equals(sig)) throw Error('Invalid source PNG');
let pos=8, width, height, channels, depth, interlace, palette, transparency;
const chunks=[];
while(pos < file.length){
  const n=file.readUInt32BE(pos); pos+=4;
  const type=file.toString('ascii',pos,pos+4); pos+=4;
  const chunk=file.subarray(pos,pos+n); pos+=n+4;
  if(type==='IHDR'){
    width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);
    depth=chunk[8];channels=chunk[9]===2?3:chunk[9]===6?4:0;interlace=chunk[12];
  }
  if(type==='IDAT') chunks.push(chunk);
  if(type==='PLTE') palette=chunk;
  if(type==='tRNS') transparency=chunk;
  if(type==='IEND') break;
}
if(width!==1200 || height!==630 || depth!==8 || !channels || interlace!==0){
  throw Error('Unexpected source dimensions/format; inspect og-home-v2.png before editing');
}
const input=zlib.inflateSync(Buffer.concat(chunks));
const stride=width*channels, pixels=Buffer.alloc(height*stride);
let offset=0;
for(let y=0;y<height;y++){
  const filter=input[offset++], base=y*stride;
  for(let x=0;x<stride;x++){
    const v=input[offset++], a=x>=channels?pixels[base+x-channels]:0;
    const b=y?pixels[base-stride+x]:0;
    const c=y&&x>=channels?pixels[base-stride+x-channels]:0;
    let predictor=0;
    if(filter===1) predictor=a;
    if(filter===2) predictor=b;
    if(filter===3) predictor=Math.floor((a+b)/2);
    if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
    if(filter>4) throw Error('Unsupported PNG filter');
    pixels[base+x]=(v+predictor)&255;
  }
}
const newHeight=530;
const output=Buffer.from(pixels.subarray(0,newHeight*stride));
// Remove the decorative favicon from the social banner without altering
// the name, subtitle, rules or background.
const copyX=1032, copyY=488, copyW=120;
for(let y=copyY;y<newHeight;y++) {
  for(let x=copyX;x<copyX+copyW;x++) {
    const p=y*stride+x*channels;
    output[p]=11; output[p+1]=11; output[p+2]=12;
    if(channels===4) output[p+3]=255;
  }
}
function crc32(b){let crc=-1;for(const byte of b){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^(-1))>>>0;}
function pngChunk(type,data){const name=Buffer.from(type,'ascii');const header=Buffer.alloc(4);header.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([header,name,data,crc]);}
const scanlines=Buffer.alloc(newHeight*(1+stride));
for(let y=0;y<newHeight;y++) output.copy(scanlines,y*(stride+1)+1,y*stride,(y+1)*stride);
const ihdr=Buffer.alloc(13);
ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(newHeight,4);ihdr[8]=8;ihdr[9]=channels===3?2:6;
const png=Buffer.concat([sig,pngChunk('IHDR',ihdr),pngChunk('IDAT',zlib.deflateSync(scanlines,{level:9})),pngChunk('IEND',Buffer.alloc(0))]);
fs.writeFileSync(destination,png);
console.log('Generated',destination,width,'x',newHeight,png.length,'bytes');
