"""Fresh synthetic product acceptance files. No existing media or user data is read."""
from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
import math,wave,struct,zipfile,json,hashlib,importlib.metadata,sys
root=Path(__file__).resolve().parent
marker='CUEPOINT-NATIVE-FULL-20261011-Q7'
lines=[marker,'第一场：雨夜。角色林七举着红色雨伞，走进蓝色车站。','第二场：清晨。道具是一封没有寄出的信；风格为暖色写实。','Native project document parsing fixture. Imported bytes must remain internal.']
text='\n'.join(lines)+'\n'
(root/'reference.txt').write_text(text,encoding='utf-8')
(root/'reference.md').write_text('# '+marker+'\n\n'+ '\n\n'.join(lines[1:])+'\n',encoding='utf-8')
image=Image.new('RGB',(96,64))
image.putdata([(12 if x<32 else 210,160 if y<32 else 40,(x*3+y*2)%256) for y in range(64) for x in range(96)])
image.save(root/'image.png',optimize=False)
with wave.open(str(root/'tone.wav'),'wb') as sound:
 sound.setnchannels(1);sound.setsampwidth(2);sound.setframerate(48000)
 sound.writeframes(b''.join(struct.pack('<h',round(math.sin(i*2*math.pi*440/48000)*1000)) for i in range(96000)))
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
pdf=canvas.Canvas(str(root/'reference.pdf'),pagesize=(595,842),invariant=1,pageCompression=0)
pdf.setFont('Helvetica',12);pdf.drawString(48,790,marker)
pdf.setFont('STSong-Light',12)
for index,line in enumerate(lines[1:3]):pdf.drawString(48,750-index*32,line)
pdf.setFont('Helvetica',10);pdf.drawString(48,660,lines[3]);pdf.showPage();pdf.save()
def xml(value): return value.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
entries={
 '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
 'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+''.join('<w:p><w:r><w:t>'+xml(line)+'</w:t></w:r></w:p>' for line in lines)+'</w:body></w:document>'}
with zipfile.ZipFile(root/'reference.docx','w',compression=zipfile.ZIP_DEFLATED) as doc:
 for name,value in entries.items():
  info=zipfile.ZipInfo(name,date_time=(2026,10,11,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;doc.writestr(info,value)
(root/'existing-empty.csv').write_bytes(b'')
(root/'existing-keep.csv').write_bytes(b'CUEPOINT-EXISTING-TARGET-MUST-REMAIN-Q7\n')
files={}
for name in ['image.png','movie.mp4','tone.wav','reference.pdf','reference.docx','reference.txt','reference.md','existing-empty.csv','existing-keep.csv']:
 p=root/name
 if p.exists():files[name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
manifest={'format':'cuepoint.synthetic-native-product-acceptance.v1','marker':marker,'expectedDocumentText':lines,'synthetic':True,'userFilesRead':False,'generators':{'python':sys.version,'Pillow':importlib.metadata.version('Pillow'),'reportlab':importlib.metadata.version('reportlab'),'audio':'wave PCM16 mono 48000Hz 2s 440Hz','video':'fresh AVFoundation H264 64x48 12fps 24frames (existing generator source only)'},'sourceHashes':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in ['generate-sources.py','generate-video.swift']},'files':files}
(root/'source-provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(files,indent=2))
