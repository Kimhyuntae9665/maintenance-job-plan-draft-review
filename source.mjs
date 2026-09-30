import {createHash} from 'node:crypto';
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:canonical(value),'utf8').digest('hex');
const fail=message=>{throw new Error(message);};
const pointerKey=key=>key.replaceAll('~','~0').replaceAll('/','~1');

// Parse JSON without silently accepting duplicate object keys. Record exact raw
// lexical spans; decoded strings remain distinct from their quoted literals.
export function jsonSpans(text){
  let i=0;const spans=new Map();
  const ws=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++;};
  const string=()=>{const start=i;if(text[i++]!=='"')fail('JSON string expected');while(i<text.length){const c=text[i++];if(c==='"')return {value:JSON.parse(text.slice(start,i)),start,end:i};if(c==='\\')i++;}fail('Unterminated JSON string');};
  const value=path=>{ws();const start=i;let out;
    if(text[i]==='"')out=string().value;
    else if(text[i]==='{'){i++;out=Object.create(null);const seen=new Set();ws();if(text[i]!=='}')while(true){ws();const key=string().value;if(seen.has(key))fail('Duplicate JSON object key');seen.add(key);ws();if(text[i++]!==':')fail('JSON colon expected');out[key]=value(path+'/'+pointerKey(key));ws();if(text[i]===','){i++;continue;}break;}if(text[i++]!=='}')fail('JSON object close expected');}
    else if(text[i]==='['){i++;out=[];ws();if(text[i]!==']')while(true){out.push(value(path+'/'+out.length));ws();if(text[i]===','){i++;continue;}break;}if(text[i++]!==']')fail('JSON array close expected');}
    else {const match=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));if(!match)fail('Invalid JSON value');i+=match[0].length;out=JSON.parse(match[0]);}
    spans.set(path,{start,end:i,raw:text.slice(start,i)});return out;
  };
  const result=value('');ws();if(i!==text.length)fail('Trailing JSON content');JSON.parse(text);return {value:result,spans};
}
export const REQUIRED=['row_id','equipment_id','organization','site','task_text','frequency','responsible_role'];
export function importSource({source_id,namespace,source_revision,format,text}){
  for(const [k,v] of Object.entries({source_id,namespace,source_revision}))if(typeof v!=='string'||!v.trim())fail('Missing source identity: '+k);
  if(typeof text!=='string'||Buffer.byteLength(text)>1024*1024)fail('Source must be bounded UTF-8 text');
  const file_hash=hash(text),rows=[];
  const cell=(value,locator,span)=>{
    if(typeof value!=='string')fail('Cells must be strings; equipment identifiers cannot be numeric');
    return {value,locator,span:{...span,encoding:'UTF-16 code units',utf8_start:Buffer.byteLength(text.slice(0,span.start)),utf8_end:Buffer.byteLength(text.slice(0,span.end))},file_hash,source_id,namespace,source_revision};
  };
  if(format==='tsv'){
    const lines=[];const re=/([^\r\n]*)(\r\n|\n|\r|$)/g;let m;
    while((m=re.exec(text))&&m[0])lines.push({text:m[1],start:m.index});
    if(!lines.length)fail('Empty TSV');const headers=lines[0].text.split('\t');if(new Set(headers).size!==headers.length||headers.some(x=>!x))fail('TSV needs unique named columns');
    for(let n=1;n<lines.length;n++){
      const line=lines[n];if(line.text===''){rows.push({locator:'row:'+(n+1),section_break:true,cells:{}});continue;}
      const values=line.text.split('\t');if(values.length!==headers.length)fail('TSV column count mismatch at row '+(n+1));let offset=line.start;const cells=Object.create(null);
      for(let col=0;col<headers.length;col++){const v=values[col];cells[headers[col]]=cell(v,`row:${n+1}/column:${col+1}`,{start:offset,end:offset+v.length,raw:v});offset+=v.length+1;}
      rows.push({locator:'row:'+(n+1),section_break:false,cells});
    }
  }else if(format==='json'){
    const parsed=jsonSpans(text);const data=parsed.value;if(!data||!Array.isArray(data.rows))fail('JSON source schema requires rows array');
    for(let n=0;n<data.rows.length;n++){
      const row=data.rows[n];if(!row||typeof row!=='object'||Array.isArray(row))fail('JSON rows must be objects');const cells=Object.create(null);
      for(const [name,v] of Object.entries(row))cells[name]=cell(v,`/rows/${n}/${pointerKey(name)}`,parsed.spans.get(`/rows/${n}/${pointerKey(name)}`));
      rows.push({locator:`/rows/${n}`,section_break:Object.keys(cells).length===0,cells});
    }
  }else fail('Only TSV/JSON are supported');
  for(const row of rows)if(row.cells.source_revision&&row.cells.source_revision.value!==source_revision)fail('Ambiguous row/source revision: this slice requires one declared source revision');
  return {source_id,namespace,source_revision,format,text,file_hash,rows,original:true};
}
export function findConflicts(sources){
  const groups=new Map();
  for(const source of sources)for(const row of source.rows){if(row.section_break||!row.cells.row_id?.value)continue;
    const key=canonical([source.namespace,row.cells.row_id.value,source.source_revision]);
    const values=canonical(Object.fromEntries(Object.entries(row.cells).map(([k,c])=>[k,c.value])));
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push({source_id:source.source_id,file_hash:source.file_hash,row_locator:row.locator,values});
  }
  return [...groups.entries()].filter(([,rows])=>new Set(rows.map(r=>r.values)).size>1).map(([key,rows])=>({key,rows,state:'CONFLICTING_SOURCE_ROWS'}));
}
export function resolveCell(source,locator){for(const row of source.rows)for(const c of Object.values(row.cells))if(c.locator===locator)return c;return null;}
