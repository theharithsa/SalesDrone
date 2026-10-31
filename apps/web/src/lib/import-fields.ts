import { type FieldOptions, type CustomField, standardFieldLabels } from './field-options.ts';
export const fieldNameKey = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en');
export type ImportFieldProposal = { index: number; label: string };
/** Account only for populated columns not already mapped or selected as comments. */
export function unmatchedImportFields(headers: string[], rows: string[][], mapping: Record<string,string>, comments: number[], config: FieldOptions): ImportFieldProposal[] {
  const used = new Set([...Object.values(mapping).map(Number).filter(i=>i>=0), ...comments]);
  const reserved = new Set(Object.values({...standardFieldLabels,...config.labels}).map(fieldNameKey));
  const proposed = new Set<string>();
  return headers.flatMap((header,index)=>{
    if(used.has(index)||!rows.some(row=>(row[index]||'').trim()))return [];
    const base=header.trim()||`Column ${index+1}`;
    const suffix=` (column ${index+1})`;
    let label=base.slice(0,80);
    if(headers.filter(h=>fieldNameKey(h)===fieldNameKey(header)).length>1||reserved.has(fieldNameKey(label))||proposed.has(fieldNameKey(label)))label=base.slice(0,80-suffix.length)+suffix;
    proposed.add(fieldNameKey(label));return [{index,label}];
  });
}
/** Resolve against fresh server configuration, reusing IDs after retries/concurrent creation. */
export function resolveImportFields(config: FieldOptions, proposals: ImportFieldProposal[], createId: ()=>string, existingMapping: Record<string,string> = {}) {
  const fields=[...config.customFields], mapping:Record<string,string>={};
  const reserved=new Set(Object.values({...standardFieldLabels,...config.labels}).map(fieldNameKey));
  const selected=new Set<string>();
  for(const proposal of proposals){
    const label=proposal.label.trim(), key=fieldNameKey(label);
    if(!label||label.length>80||/[\r\n\u0000-\u001f]/.test(label))throw Error('Use a field name of 1–80 characters without control characters.');
    if(reserved.has(key)||selected.has(key))throw Error('Choose distinct field names that do not duplicate standard fields.');
    selected.add(key);
    let field=fields.find(f=>!f.deleted&&fieldNameKey(f.label)===key);
    if(!field){field={id:createId(),label,type:'text',options:[],required:false,deleted:false} satisfies CustomField;fields.push(field);}
    if(Number(existingMapping[field.id]??'-1')>=0 && Number(existingMapping[field.id])!==proposal.index)throw Error('This field is already mapped to another column. Choose a distinct field name.');
    mapping[field.id]=String(proposal.index);
  }
  if(fields.filter(f=>!f.deleted).length>30||fields.length>100)throw Error('This workspace supports 30 active custom fields. Map columns to existing fields or comments, or explicitly exclude columns before continuing.');
  return {fields,mapping,created:fields.length-config.customFields.length};
}
