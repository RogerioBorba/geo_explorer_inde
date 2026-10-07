import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enderecoPublico, validarDestino, certificadoInvalido } from '../src/lib/request/proxySeguro.ts';

test('bloqueia redes privadas, locais e IPv4 em IPv6', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1']) assert.equal(enderecoPublico(address), false, address);
  assert.equal(enderecoPublico('8.8.8.8'), true);
  assert.equal(enderecoPublico('2606:4700:4700::1111'), true);
});
test('exceção TLS só se aplica a falhas de certificado reconhecidas', () => {
  assert.equal(certificadoInvalido(Object.assign(new Error('certificado'), { code: 'CERT_HAS_EXPIRED' })), true);
  assert.equal(certificadoInvalido(Object.assign(new Error('rede'), { code: 'ECONNREFUSED' })), false);
  assert.equal(certificadoInvalido(new Error('qualquer falha')), false);
});
test('rejeita protocolo, credenciais, porta e host alheio ao catálogo', () => {
  const hosts = new Set(['dados.example']);
  for (const url of ['file:///etc/passwd', 'https://outro.example/wms', 'https://user:pass@dados.example/wms', 'https://dados.example:8080/wms', 'http://localhost/wms']) assert.throws(() => validarDestino(url, hosts));
  assert.equal(validarDestino('https://dados.example/wms?a=1&b=2', hosts).searchParams.get('b'), '2');
});
