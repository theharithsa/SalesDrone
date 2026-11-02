export default function LeadHeaderContext({company,phone}:{company?:string;phone?:string}) {
 const dial=phone && /^\+?[\d\s().-]+$/.test(phone.trim()) ? phone.replace(/[\s().-]/g,'') : null;
 return <p className="lead-header-context">
  <span>{company || 'Independent enquiry'}</span>
  {phone ? <><span aria-hidden="true">·</span>{dial ? <a className="mono" href={'tel:'+dial} data-dtrum-mask="" data-dt-mask="">{phone}</a> : <span className="mono" data-dtrum-mask="" data-dt-mask="">{phone}</span>}</> : null}
 </p>;
}
