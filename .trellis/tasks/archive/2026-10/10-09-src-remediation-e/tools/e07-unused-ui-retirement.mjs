import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const list={
'src/components/ui/sheet.tsx':['SheetTrigger','SheetClose','SheetFooter'],
'src/components/ui/dropdown-menu.tsx':['DropdownMenuPortal','DropdownMenuGroup','DropdownMenuRadioGroup','DropdownMenuRadioItem'],
'src/components/ui/popover.tsx':['PopoverAnchor'],
'src/components/ui/card.tsx':['CardContent'],
'src/components/ui/dialog.tsx':['DialogClose'],
'src/components/ui/alert-dialog.tsx':['AlertDialogTrigger'],
};
const out='.trellis/tasks/10-09-src-remediation-e/research/e07-unused-ui-retirement';await mkdir(out);const receipts=[];const hash=s=>createHash('sha256').update(s).digest('hex');
for(const[file,names]of Object.entries(list)){
 const source=await readFile(file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let result=source;const ranges=[];
 for(const n of ast.statements){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))ranges.push([n.getStart(ast),n.end]);if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&names.includes(d.name.text)))ranges.push([n.getStart(ast),n.end]);}
 if(ranges.length!==names.length)throw Error('Missing exactsingledeclaration '+file);
 for(const[start,end]of ranges.sort((a,b)=>b[0]-a[0]))result=result.slice(0,start)+result.slice(end);
 for(const name of names){const re=new RegExp(`(^|,|\\n)(\\s*)${name}(\\s*)(?=,|})`,'g');result=result.replace(re,(m,prefix)=>prefix==='\n'?'\n':prefix);result=result.replace(new RegExp(`\\n[ \\t]*,`,'g'),'\n');result=result.replace(/,\s*,/g,',');}
 const dest=out+'/'+file;await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});await writeFile(dest,source);await writeFile(file,result);receipts.push({path:file,names,beforeSHA256:hash(source),afterSHA256:hash(result),beforeCopy:dest,reason:'Freshfulltest/source/nativeconsumer scan found noexternalorinternalread; unusedprimitive adapters notpublicpackageAPI; retained live content/portals/separators/selection implementations separately.'});
}
await writeFile(out+'/receipt.json',JSON.stringify(receipts,null,2)+'\n');console.log('Retired',Object.values(list).flat().length,'unusedadapters, actual DropdownMenuSeparator/SelectSeparator remain');
