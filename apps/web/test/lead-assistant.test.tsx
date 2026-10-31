import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import LeadAssistantView from '../src/features/LeadAssistantView';
const props=()=>({messages:[],draft:'Show leads in North',onDraft:vi.fn(),onSend:vi.fn(),onNewChat:vi.fn(),onSelectChat:vi.fn(),onClarify:vi.fn()});
describe('Assistant conversation interaction',()=>{
  it('sends Enter but preserves Shift-Enter and IME composition',()=>{
    const p=props();render(<LeadAssistantView {...p}/>);const input=screen.getByRole('textbox',{name:'Ask about your leads'});
    fireEvent.keyDown(input,{key:'Enter',shiftKey:true});fireEvent.keyDown(input,{key:'Enter',isComposing:true});expect(p.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input,{key:'Enter'});expect(p.onSend).toHaveBeenCalledExactlyOnceWith('Show leads in North');
  });
  it('renders untrusted source text literally and fetches matching records only on request',()=>{
    const p=props(),onLoad=vi.fn();render(<LeadAssistantView {...p} onLoadResults={onLoad} messages={[{id:'result',role:'assistant',text:'2 matching leads.',resultRequestId:'request',resultCount:2,sources:[{id:'s',label:'Fictional note',excerpt:'<img src=x onerror=alert(1)>'}]}]}/>);
    expect(document.querySelector('img')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'View matching leads (2)'}));expect(onLoad).toHaveBeenCalledWith('request');
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});
