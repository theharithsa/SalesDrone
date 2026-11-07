import {describe,it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import LeadHeaderContext from '../src/components/LeadHeaderContext';
describe('Lead header contact',()=>{
 it('keeps the enquiry context and exposes the formatted primary phone as a dial link',()=>{
  render(<LeadHeaderContext phone="+91 55500 12345"/>);
  expect(screen.getByText('Individual Customer')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'+91 55500 12345'})).toHaveAttribute('href','tel:+915550012345');
  expect(screen.getByRole('link',{name:'+91 55500 12345'})).toHaveClass('phone-number');
 });
 it('does not invent a callable number from invalid contact data',()=>{
  render(<LeadHeaderContext company="Fictional Supplies" phone="Needs review"/>);
  expect(screen.getByText('Fictional Supplies')).toBeInTheDocument();expect(screen.queryByRole('link')).not.toBeInTheDocument();
 });
 it('shows configured values together and links only recognized phone numbers', () => {
  render(<LeadHeaderContext company="Fictional Supplies" phone="2025550110" fields={[
   { id: 'secondary', label: 'Phone number 2', value: '020 7946 0958' },
   { id: 'contact', label: 'After hours', value: '+1 (202) 555-0117' },
   { id: 'reference', label: 'Reference number', value: '0123456789' },
   { id: 'invalid', label: 'Mobile', value: '2025550118;ext=123' },
  ]}/>);
  const secondary = screen.getByRole('link', { name: 'Phone number 2, 020 7946 0958' });
  expect(secondary).toHaveAttribute('href', 'tel:02079460958');
  expect(secondary).toHaveClass('phone-number');
  expect(secondary.closest('[data-dt-mask]')).not.toBeNull();
  expect(screen.getByRole('link', { name: 'After hours, +1 (202) 555-0117' })).toHaveAttribute('href', 'tel:+12025550117');
  expect(screen.queryByText('Phone number 2')).not.toBeInTheDocument();
  expect(screen.getByText('Reference number:')).toHaveClass('sr-only');
  expect(screen.getByText('0123456789').closest('a')).toBeNull();
  expect(screen.getByText('2025550118;ext=123').closest('a')).toBeNull();
 });
});
