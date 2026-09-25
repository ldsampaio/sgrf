// Prova estática de SAFE-02: nenhum caminho de escrita de ref nem trilha
// destrutiva de tag existe nas fontes não-teste, e nenhum fixture carrega
// segredo embutido.
//
// Roda com: node --test tools/release-close/. Varre apenas fontes não-teste
// (*.js exceto *.test.js) sob tools/release-close/ — este próprio arquivo e
// os demais testes nunca entram na varredura.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TOOL_DIR = new URL('./', import.meta.url);

// Nomes de rotina de escrita que nunca podem existir na superfície.
const BANNED_ROUTINES = [
  'createTag',
  'updateRef',
  'deleteRef',
  'createRelease',
  'updateRelease',
  'deleteRelease',
  'createMilestone',
  'updateMilestone',
  'deleteMilestone',
];

// Caminhos de ref e porcelana destrutiva que nunca podem aparecer.
const BANNED_PATHS = [
  'update-ref',
  'delete-ref',
  'create-ref',
  'release create',
  'release delete',
];

// Verbos de método de escrita (palavra inteira, sensível a maiúsculas).
const BANNED_METHOD_WORDS = ['POST', 'PATCH', 'PUT', 'DELETE'];

// Segredos e traços verbosos que nunca podem ser lidos ou registrados.
const BANNED_SECRETS = ['GH_TOKEN', 'GITHUB_TOKEN', 'Authorization', 'Bearer', '--verbose'];

// Formatos de segredo que nunca podem aparecer em fixture versionado.
const BANNED_CREDENTIAL_SHAPES = [
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'Authorization',
  'Bearer',
  'ghp_',
  'gho_',
  '-----BEGIN',
];

function listSourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...listSourceFiles(full));
    } else if (entry.endsWith('.js') && !entry.endsWith('.test.js')) {
      found.push(full);
    }
  }
  return found;
}

function listFixtureFiles(dir) {
  const found = [];
  const fixtures = join(dir, 'fixtures');
  for (const entry of readdirSync(fixtures)) {
    if (entry.endsWith('.json')) found.push(join(fixtures, entry));
  }
  return found;
}

describe('prova estática de zero-escrita (SAFE-02)', () => {
  it('varre apenas fontes não-teste do tool island', () => {
    const fontes = listSourceFiles(TOOL_DIR.pathname);
    assert.ok(fontes.length > 0);
    for (const fonte of fontes) {
      assert.ok(!fonte.endsWith('.test.js'), `teste na varredura: ${fonte}`);
    }
  });

  it('nenhuma fonte carrega rotina de escrita de ref ou release', () => {
    for (const fonte of listSourceFiles(TOOL_DIR.pathname)) {
      const texto = readFileSync(fonte, 'utf8');
      for (const token of BANNED_ROUTINES) {
        assert.ok(!texto.includes(token), `${fonte} contém rotina proibida: ${token}`);
      }
    }
  });

  it('nenhuma fonte carrega caminho de ref nem porcelana destrutiva', () => {
    for (const fonte of listSourceFiles(TOOL_DIR.pathname)) {
      const texto = readFileSync(fonte, 'utf8');
      for (const token of BANNED_PATHS) {
        assert.ok(!texto.includes(token), `${fonte} contém caminho proibido: ${token}`);
      }
    }
  });

  it('nenhuma fonte carrega verbo de método de escrita', () => {
    for (const fonte of listSourceFiles(TOOL_DIR.pathname)) {
      const texto = readFileSync(fonte, 'utf8');
      for (const verbo of BANNED_METHOD_WORDS) {
        assert.ok(
          !new RegExp(`\\b${verbo}\\b`).test(texto),
          `${fonte} contém verbo de método proibido: ${verbo}`,
        );
      }
    }
  });

  it('nenhuma fonte lê segredo nem registra traço verboso', () => {
    for (const fonte of listSourceFiles(TOOL_DIR.pathname)) {
      const texto = readFileSync(fonte, 'utf8');
      for (const token of BANNED_SECRETS) {
        assert.ok(!texto.includes(token), `${fonte} contém token proibido: ${token}`);
      }
    }
  });

  it('nenhum fixture versionado contém formato de credencial', () => {
    const fixtures = listFixtureFiles(TOOL_DIR.pathname);
    assert.ok(fixtures.length >= 7);
    for (const fixture of fixtures) {
      const texto = readFileSync(fixture, 'utf8');
      for (const token of BANNED_CREDENTIAL_SHAPES) {
        assert.ok(!texto.includes(token), `${fixture} contém formato de credencial: ${token}`);
      }
    }
  });

  it('o rascunho gh falha fechado em todos os métodos nomeando a Fase 10', async () => {
    const { ghClient } = await import('./gh-client.js');
    for (const metodo of ['getTagRef', 'getTagObject', 'getBranchHead', 'getReleaseByTag', 'listMilestones']) {
      await assert.rejects(
        () => ghClient[metodo]('v0.1.1'),
        (erro) => erro instanceof Error && erro.message.includes('Fase 10'),
        `método ${metodo} não falha nomeando a Fase 10`,
      );
    }
  });
});
