/* Credentials remain in Swagger's memory, never in browser storage or analytics. */
const portal = SwaggerUIBundle({
  url: '/openapi.json',
  dom_id: '#swagger-ui',
  persistAuthorization: false,
  validatorUrl: null,
  displayRequestDuration: true,
  filter: true,
  deepLinking: true,
  docExpansion: 'none',
  defaultModelsExpandDepth: 1,
  tryItOutEnabled: false,
  requestInterceptor(request) {
    const u = new URL(request.url, location.origin);
    if (
      u.origin !== location.origin ||
      (!u.pathname.startsWith('/api/v1/') && u.pathname !== '/openapi.json')
    )
      throw new Error(
        'The API portal only sends requests to this SalesDrone origin.',
      );
    return request;
  },
});
window.addEventListener('pagehide', () =>
  portal.authActions.logout([
    'personalAccessToken',
    'firebaseIdToken',
    'appCheck',
  ]),
);
