import {describe,it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import LeadHeaderContext from '../src/components/LeadHeaderContext';
describe('Lead header contact',()=>{
 it('keeps the enquiry context and exposes the formatted primary phone as a dial link',()=>{
  render(<LeadHeaderContext phone="+91 55500 12345"/>);
  expect(screen.getByText('Independent enquiry')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'+91 55500 12345'})).toHaveAttribute('href','tel:+915550012345');
  expect(screen.getByRole('link',{name:'+91 55500 12345'})).toHaveClass('phone-number');
 });
 it('does not invent a callable number from invalid contact data',()=>{
  render(<LeadHeaderContext company="Fictional Supplies" phone="Needs review"/>);
  expect(screen.getByText('Fictional Supplies')).toBeInTheDocument();expect(screen.queryByRole('link')).not.toBeInTheDocument();
 });
});
