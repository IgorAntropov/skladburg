import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  restoreRequest,
  restoreResponse,
  serializeRequest,
  serializeResponse,
} from './httpMessages';

const URL_VALUE = 'https://demo-engine.invalid/organization.v1.OrganizationService/ListWarehouses';

describe('request serialization', () => {
  it('moves url, method, header pairs and body into the message and transfers the body', async () => {
    const request = new Request(URL_VALUE, {
      body: new Uint8Array([1, 2, 3]),
      headers: { 'content-type': 'application/proto', 'x-demo-user-id': 'user-1' },
      method: 'POST',
    });

    const { message, transfer } = await serializeRequest(request, 'request-1');

    expect(message).toMatchObject({ method: 'POST', requestId: 'request-1', type: 'request', url: URL_VALUE });
    expect(message.headers).toEqual(expect.arrayContaining([['content-type', 'application/proto'], ['x-demo-user-id', 'user-1']]));
    expect(new Uint8Array(message.body)).toEqual(new Uint8Array([1, 2, 3]));
    expect(transfer).toEqual([message.body]);
  });

  it('restores a request that carries the same bytes and headers', async () => {
    const original = new Request(URL_VALUE, { body: new Uint8Array([9, 8]), headers: { 'x-a': '1' }, method: 'POST' });
    const { message } = await serializeRequest(original, 'request-1');

    const restored = restoreRequest(structuredClone(message));

    expect(restored.url).toBe(URL_VALUE);
    expect(restored.method).toBe('POST');
    expect(restored.headers.get('x-a')).toBe('1');
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(new Uint8Array([9, 8]));
  });

  it('restores a bodiless GET request', async () => {
    const { message } = await serializeRequest(new Request(URL_VALUE), 'request-1');

    const restored = restoreRequest(message);

    expect(restored.method).toBe('GET');
    expect(restored.body).toBeNull();
  });
});

describe('response serialization', () => {
  it('round-trips status, headers and body', async () => {
    const original = new Response(new Uint8Array([5, 6, 7]), { headers: { 'content-type': 'application/proto' }, status: 201 });

    const { message, transfer } = await serializeResponse(original, 'request-1');
    const restored = restoreResponse(structuredClone(message));

    expect(message).toMatchObject({ requestId: 'request-1', status: 201, type: 'response' });
    expect(transfer).toEqual([message.body]);
    expect(restored.status).toBe(201);
    expect(restored.headers.get('content-type')).toBe('application/proto');
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(new Uint8Array([5, 6, 7]));
  });

  it('restores a response with an empty body and a status that forbids a body', () => {
    const restored = restoreResponse({ body: new ArrayBuffer(0), headers: [], requestId: 'request-1', status: 204, type: 'response' });

    expect(restored.status).toBe(204);
    expect(restored.body).toBeNull();
  });
});
