const builtin = ['stage','legacyStatus','source','zone','location'];
export const categoryKey = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en');
export function dashboardFields(config) {
  return [
    ...builtin.filter(field=>!config.hiddenFields.includes(field)).map(field=>({field,label:config.labels?.[field]||field,order:config.values[field]||[]})),
    ...config.customFields.filter(f=>!f.deleted&&['select','text'].includes(f.type)).map(f=>({field:f.id,label:f.label,order:f.options})),
  ];
}
/** Same normalized equality as lead filters; a missing bucket uses Is empty. */
export function dashboardGrouping(leads, config, requested = 'auto') {
  const availableFields=dashboardFields(config);
  const selected=availableFields.find(f=>f.field===requested)||availableFields[0];
  const buckets=new Map();
  for(const label of selected?.order||[])buckets.set('v:'+categoryKey(label),{key:'v:'+categoryKey(label),label,value:0,empty:false,filterable:label.length<=400});
  if(selected)for(const lead of leads){
    const raw=selected.field.startsWith('cf_')?lead.customFields?.[selected.field]:lead[selected.field];
    const value=String(raw??'').trim(), normalized=categoryKey(value), key=normalized?'v:'+normalized:'missing';
    if(!buckets.has(key))buckets.set(key,{key,label:value||'Not recorded',value:0,empty:!normalized,filterable:value.length<=400});
    buckets.get(key).value++;
  }
  return {requested,field:selected?.field||null,label:selected?.label||'Pipeline distribution',unavailable:requested!=='auto'&&!availableFields.some(f=>f.field===requested),availableFields:availableFields.map(({field,label})=>({field,label})),groups:visibleGroups(selected?.field==='stage'?[...buckets.values()]:[...buckets.values()].sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label)))};
}

function visibleGroups(groups){
  if(groups.length<=20)return groups;
  const sorted=[...groups].sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
  const top=sorted.slice(0,20),remaining=sorted.slice(20).reduce((n,g)=>n+g.value,0);
  return remaining?[...top,{key:'other',label:'Other values (combined)',value:remaining,empty:false,aggregate:true}]:top;
}
