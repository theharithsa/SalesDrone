/** Render the real form components. This checks semantics, not browser geometry. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const server = await createServer({
  root: resolve('apps/web'),
  configFile: resolve('apps/web/vite.config.ts'),
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const forms = await server.ssrLoadModule('/src/components/Forms.tsx');
  const { default: TaskEditForm } = await server.ssrLoadModule(
    '/src/components/TaskEditForm.tsx',
  );
  const { default: CustomFieldInputs } = await server.ssrLoadModule(
    '/src/components/CustomFieldInputs.tsx',
  );
  const { demoData } = await server.ssrLoadModule('/src/lib/demo.ts');
  const { defaultFieldOptions } = await server.ssrLoadModule(
    '/src/lib/field-options.ts',
  );
  const sample = demoData();
  assert.equal(sample.leads.length, 96, 'demo spans multiple 30-row pages');
  assert.equal(new Set(sample.leads.map((lead) => lead.id)).size, 96);
  assert.equal(new Set(sample.leads.map((lead) => lead.name)).size, 96);
  assert.ok(sample.leads.every((lead) => lead.email.endsWith('@example.com')));
  const noop = () => {};
  const shared = { onSave: async () => {}, onCancel: noop };
  const cases = [
    [
      forms.LeadForm,
      {
        ...shared,
        config: {
          ...defaultFieldOptions,
          labels: { ...defaultFieldOptions.labels, name: 'Customer / account' },
        },
      },
      ['name', 'phone', 'enquiryDate'],
    ],
    [
      forms.CallForm,
      { ...shared, lead: sample.leads[0] },
      ['outcome', 'notes'],
    ],
    [
      forms.TaskForm,
      { ...shared, leadId: sample.leads[0].id },
      ['title', 'dueAt', 'kind'],
    ],
    [
      TaskEditForm,
      { ...shared, task: sample.tasks[0] },
      ['title', 'dueAt', 'kind', 'state'],
    ],
  ];
  for (const [component, props, fields] of cases) {
    const html = renderToStaticMarkup(createElement(component, props));
    for (const name of fields) {
      const label = [
        ...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g),
      ].find(([value]) => value.includes(`name="${name}"`));
      assert.ok(
        label,
        `${component.name}: ${name} retains an associated label`,
      );
      assert.match(
        label[0],
        /class="material-field(?: full)?"/,
        `${component.name}: ${name} uses shared outlined field`,
      );
      assert.match(
        label[0],
        /class="field-label"/,
        `${component.name}: ${name} has a persistent label`,
      );
    }
    assert.match(html, /type="submit"/);
    assert.match(html, /type="button"/);
    if (component === forms.LeadForm)
      assert.ok(html.includes('Customer / account'));
    if (component === forms.TaskForm)
      assert.match(
        html,
        /<input(?=[^>]*name="dueAt")(?=[^>]*required="")[^>]*>/,
      );
  }
  const html = renderToStaticMarkup(
    createElement(CustomFieldInputs, {
      fields: [
        {
          id: 'cf_optional',
          label: 'Project notes',
          type: 'textarea',
          required: false,
          deleted: false,
          options: [],
        },
        {
          id: 'cf_required',
          label: 'Region',
          type: 'select',
          required: true,
          deleted: false,
          options: ['East', 'West'],
        },
        {
          id: 'cf_consent',
          label: 'Approved',
          type: 'checkbox',
          required: false,
          deleted: false,
          options: [],
        },
      ],
    }),
  );
  assert.match(html, /class="field-label">Project notes<\/span>/);
  assert.match(html, /class="field-label">Region \*<\/span>/);
  assert.match(html, /class="checkbox-row"/);
  assert.match(
    html,
    /<input(?=[^>]*name="custom:cf_consent")(?=[^>]*type="checkbox")[^>]*>/,
  );
  assert.ok(!html.includes('Project notesmaterial-field'));
  console.log(
    'Five real form render checks passed: labelled fields, configured names, required dates, actions and custom checkbox semantics. Browser layout and interactions remain separate checks.',
  );
} finally {
  await server.close();
}
