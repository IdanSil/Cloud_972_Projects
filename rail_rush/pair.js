/* Rail Rush pocket controller: pairing helpers shared by the game (index.html) and the phone (controller.html).
 *
 * The game opens a PeerJS peer named after a short room code; the phone connects to it, and the two
 * talk over a WebRTC data channel. The free PeerJS cloud broker is only used to find each other.
 * For testing or self-hosting, the page URL can name another broker:
 *   ?peerhost=localhost&peerport=9000&peerpath=/&peersecure=0
 *
 * Messages (JSON objects, field t = type):
 *   phone → game  hello / state / hb { ready, status }   jump / duck / up { id, ts, src }
 *                 say { text }   pong { ts }   tel { av, v } (debug only)
 *   game → phone  game { state }   ping { ts }   debug { on }
 */
(function (root) {
  'use strict';
  const LIBS = {
    peer: 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    qr: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  };
  const PREFIX = 'railrush-v1-';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L
  const loading = {};

  function loadScript(url) {
    return loading[url] || (loading[url] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = resolve;
      s.onerror = () => { delete loading[url]; s.remove(); reject(new Error('Could not load ' + url)); };
      document.head.append(s);
    }));
  }
  function brokerParams() {
    const q = new URLSearchParams(location.search), o = {};
    for (const k of ['peerhost', 'peerport', 'peerpath', 'peersecure']) if (q.has(k)) o[k] = q.get(k);
    return o;
  }
  function peerOptions() {
    const b = brokerParams(), o = { debug: 1 };
    if (b.peerhost) {
      o.host = b.peerhost; o.secure = b.peersecure !== '0';
      o.port = +(b.peerport || (o.secure ? 443 : 80)); o.path = b.peerpath || '/';
    }
    return o;
  }
  function newCode(n = 5) {
    const a = new Uint32Array(n); (root.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 1e9; });
    return Array.from(a, x => ALPHA[x % ALPHA.length]).join('');
  }
  const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  // errors that mean "can't talk to the broker" (worth retrying)
  const NET_ERRORS = ['network', 'server-error', 'socket-error', 'socket-closed'];

  root.RRPair = {
    LIBS, NET_ERRORS, loadScript, brokerParams, peerOptions, newCode, cleanCode,
    idFor: code => PREFIX + cleanCode(code),
    loadPeer: () => (root.Peer ? Promise.resolve(root.Peer) : loadScript(LIBS.peer).then(() => root.Peer)),
    loadQR: () => (root.qrcode ? Promise.resolve(root.qrcode) : loadScript(LIBS.qr).then(() => root.qrcode)),
  };
})(window);
