/** Read dimensions from supported image headers without browser decoding or DOM. */
export async function generationImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const view=new DataView(bytes.buffer);
  const text=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
  let width=0,height=0;
  if(bytes.length>=24 && bytes[0]===137 && text(1,4)==="PNG" && text(12,16)==="IHDR") {
    width=view.getUint32(16);height=view.getUint32(20);
  } else if(bytes.length>=30 && text(0,4)==="RIFF" && text(8,12)==="WEBP") {
    if(text(12,16)==="VP8X") {width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
    else if(text(12,16)==="VP8 " && bytes[23]===0x9d && bytes[24]===0x01 && bytes[25]===0x2a) {width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
    else if(text(12,16)==="VP8L" && bytes[20]===0x2f) {width=1+bytes[21]+((bytes[22]&0x3f)<<8);height=1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&0xf)<<10);}
  } else if(bytes.length>=4 && bytes[0]===255 && bytes[1]===216) {
    let offset=2;
    while(offset+4<bytes.length) {
      if(bytes[offset]!==255) break;
      const marker=bytes[offset+1];
      if(marker===0xff) {offset++;continue;}
      if(marker===0xda||marker===0xd9) break;
      const size=view.getUint16(offset+2);
      if(size<2||offset+2+size>bytes.length) break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&size>=7) {height=view.getUint16(offset+5);width=view.getUint16(offset+7);break;}
      offset+=size+2;
    }
  }
  if(!width||!height) throw new Error("无法读取参考图片尺寸，请使用有效 PNG、JPEG 或 WebP 图片");
  return {width,height};
}
