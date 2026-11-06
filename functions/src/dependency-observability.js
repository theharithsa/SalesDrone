import { trace, metrics } from '@opentelemetry/api';
import { APP_VERSION } from './version.js';
import { errorType } from './observability-contract.js';
import { DEFAULT_GEMINI_MODEL } from './model-config.js';
import { EMBEDDING_MODEL } from './lead-research-index.js';
const models = new Set([DEFAULT_GEMINI_MODEL, EMBEDDING_MODEL]);
const finishes = new Set(['STOP','MAX_TOKENS','SAFETY','RECITATION','OTHER','BLOCKLIST','PROHIBITED_CONTENT','SPII','MALFORMED_FUNCTION_CALL','IMAGE_SAFETY']);
// Call-site-owned metadata only. No request/response content or vendor error text.
export function dependencyFailure(error, telemetry) {
  trace.getActiveSpan()?.setAttribute('error.type',errorType(error));
  (typeof telemetry==='function'?telemetry():telemetry)?.log('dependency.failed',{'dependency.name':'gemini','error.type':errorType(error)},'ERROR');
}
export async function geminiRequest(fetchImpl,url,options,telemetry) {
  const name=new URL(url).pathname.split('/').at(-1), [requested,method]=name.split(':');
  const model=models.has(requested)?requested:'other';
  const operation=method==='batchEmbedContents'?'embeddings':'generate_content';
  const attributes={'gen_ai.provider.name':'gcp.gemini','gen_ai.request.model':model,'gen_ai.operation.name':operation,'server.address':'generativelanguage.googleapis.com'};
  const span=trace.getActiveSpan();span?.setAttributes(attributes);
  const meter=metrics.getMeter('salesdrone',APP_VERSION),started=performance.now();let outcome='success';
  try {
    const response=await fetchImpl(url,options);
    if(Number.isInteger(response.status))span?.setAttribute('http.response.status_code',response.status);
    if(!response.ok){outcome='failure';const error=Object.assign(new Error('Dependency failed'),{code:response.status===429?'GEMINI_RATE_LIMIT':[400,401,403,404].includes(response.status)?'GEMINI_CONFIG':'GEMINI_UNAVAILABLE'});dependencyFailure(error,telemetry);Object.defineProperty(response,'observabilityError',{value:error});return response;}
    // Reading a clone preserves the client contract and bounds metadata extraction to
    // the same response already fetched. The body is never passed to a logger.
    const data=await (response.clone?.()||response).json();
    if(!response.clone){response.json=async()=>data;}
    const usage=data.usageMetadata;
    for(const [key,field,type] of [['gen_ai.usage.input_tokens','promptTokenCount','input'],['gen_ai.usage.output_tokens','candidatesTokenCount','output']]) {
      const value=usage?.[field];if(Number.isSafeInteger(value)&&value>=0){span?.setAttribute(key,value);meter.createCounter('salesdrone.gen_ai.tokens',{unit:'{token}'}).add(value,{model,operation,type});}
    }
    const reason=data.candidates?.[0]?.finishReason;
    if(reason)span?.setAttribute('gen_ai.response.finish_reasons',[finishes.has(reason)?reason:'OTHER']);
    return response;
  }catch(error){outcome='failure';dependencyFailure(error,telemetry);throw error;}
  finally{const labels={model,operation,outcome};meter.createCounter('salesdrone.gen_ai.requests').add(1,labels);meter.createHistogram('salesdrone.gen_ai.duration',{unit:'s'}).record((performance.now()-started)/1000,labels);}
}
export function validateProvider(fn,telemetry){try{return fn();}catch(error){dependencyFailure(error,telemetry);throw error;}}
