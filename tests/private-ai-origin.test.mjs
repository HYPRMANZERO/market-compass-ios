import test from 'node:test';
import assert from 'node:assert/strict';
import { privateTailnetOrigin } from '../artifacts/market-compass/src/lib/privateTailnetUrl.ts';
import { validateDesktopAiSettings } from '../artifacts/market-compass/src/lib/desktopAiSettings.ts';

const privateHost = 'concrete-sharper-depict.ngrok-free.dev';
const privateUrl = 'https://' + privateHost;
const token = 't'.repeat(64);
function withHost(hostname, callback) {
  const previous = globalThis.window;
  globalThis.window = { location: { protocol: 'https:', hostname, origin: 'https://' + hostname } };
  try { callback(); } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}
test('private Home Screen origin can use only its own protected ngrok API', () => {
  withHost(privateHost, () => {
    assert.equal(privateTailnetOrigin(privateUrl + '/'), privateUrl);
    assert.equal(privateTailnetOrigin('https://other-owner.ngrok-free.dev/'), null);
    assert.equal(privateTailnetOrigin(privateUrl + '/market-compass-ios/assistant'), null);
    const saved = validateDesktopAiSettings({
      url: privateUrl + '/', token, enabled: true,
      shareFinancialContext: false, speakReplies: false,
    });
    assert.equal(saved.url, privateUrl + '/');
    assert.equal(saved.token, token);
  });
});
test('public GitHub Pages icon cannot connect directly to private ngrok origin', () => {
  withHost('hyprmanzero.github.io', () => {
    assert.equal(privateTailnetOrigin(privateUrl + '/'), null);
    assert.throws(
      () => validateDesktopAiSettings({
        url: privateUrl + '/', token, enabled: true,
        shareFinancialContext: false, speakReplies: false,
      }),
      /public GitHub Pages edition/,
    );
  });
});
test('unrelated HTTP and external HTTPS origins are never trusted', () => {
  withHost(privateHost, () => {
    for (const url of [
      'http://' + privateHost + '/',
      'https://another.ngrok-free.dev/',
      'https://hyprmanzero.github.io/',
    ]) assert.equal(privateTailnetOrigin(url), null);
  });
});
