import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('../src/lib/firebase',()=>({default:{},auth:{currentUser:{getIdToken:async()=> 'synthetic'}},attestation:async()=>null}));
import {api,uploadFileBytes} from '../src/lib/api';
import {beginRumRequest,installRumErrorHandlers,rumPage} from '../src/lib/rum';
const properties=vi.fn(),report=vi.fn(),leave=vi.fn();
beforeEach(()=>{Object.assign(window,{dtrum:{enterAction:()=>7,leaveAction:leave,addActionProperties:properties,reportCustomError:report}});vi.clearAllMocks();});
afterEach(()=>vi.unstubAllGlobals());
it('actual API success, denied response, network error and cancellation export consistent outcomes once',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({ok:true}),{status:200,headers:{'X-Request-Id':id}})));
 await api('/leads/private?search=PRIVATE');
 expect(properties.mock.lastCall?.[3]).toMatchObject({'operation_outcome':'success','http_status_class':'2xx','request_id':id});
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'PRIVATE'}}),{status:403,headers:{'X-Request-Id':id}})));
 await expect(api('/leads/private','PATCH',{})).rejects.toThrow('PRIVATE');
 expect(properties.mock.lastCall?.[3]).toMatchObject({'operation_outcome':'failure','http_status_class':'4xx','error_code':'FORBIDDEN'});
 expect(report.mock.lastCall).toEqual(['salesdrone.error','FORBIDDEN',id,7]);
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('PRIVATE');}));await expect(api('/leads')).rejects.toThrow();expect(properties.mock.lastCall?.[3]['operation_outcome']).toBe('network_error');
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new DOMException('PRIVATE','AbortError');}));await expect(api('/leads')).rejects.toThrow();expect(properties.mock.lastCall?.[3]['operation_outcome']).toBe('cancelled');
 expect(leave).toHaveBeenCalledTimes(4);expect(JSON.stringify(properties.mock.calls)+JSON.stringify(report.mock.calls)).not.toContain('PRIVATE');
});
it('malformed responses, repeated completion and global failures never export exception content',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('PRIVATE',{status:502})));await expect(api('/leads')).rejects.toThrow();expect(properties.mock.lastCall?.[3]['error_code']).toBe('API_UNAVAILABLE');
 const finish=beginRumRequest('/leads','GET');finish('success',undefined,200);finish('failure',undefined,503);expect(leave).toHaveBeenCalledTimes(2);
 const remove=installRumErrorHandlers();window.dispatchEvent(new ErrorEvent('error',{message:'PRIVATE',error:new Error('PRIVATE')}));remove();expect(report.mock.lastCall?.[1]).toBe('UNHANDLED');expect(JSON.stringify(report.mock.calls)).not.toContain('PRIVATE');
});
it('an already cancelled upload closes its RUM action',async()=>{
 const controller=new AbortController();controller.abort();await expect(uploadFileBytes('/leads/private/attachments/a/content',new File(['synthetic'],'fixture.txt'),()=>{},controller.signal)).rejects.toThrow();expect(leave).toHaveBeenCalledTimes(1);expect(properties.mock.lastCall?.[3]['operation_outcome']).toBe('cancelled');
});

it('page navigation reports a bounded page intent and app version once',()=>{
 rumPage('/settings?private=PRIVATE');rumPage('/settings?private=OTHER');expect(leave).toHaveBeenCalledTimes(1);expect(properties.mock.lastCall?.[3]).toMatchObject({app_version:'component-test',interaction_intent:'View settings'});expect(JSON.stringify(properties.mock.calls)).not.toContain('PRIVATE');
});
