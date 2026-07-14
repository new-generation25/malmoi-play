/* index.html + qrcode.js → Artifact 배포용 단일 파일(malmoi-artifact.html)
 *
 * Artifact는 doctype/html/head/body 태그 없이 본문만 넣어야 하고,
 * CSP가 외부 스크립트 로드를 막으므로 라이브러리를 인라인으로 합친다.
 *
 * 사용법:  node build.js      (이 폴더에서 실행)
 */
const fs = require('fs');
const path = require('path');

const SRC = __dirname + path.sep;
const html = fs.readFileSync(SRC + 'index.html', 'utf8');
const lib = fs.readFileSync(SRC + 'qrcode.js', 'utf8');

const pick = (re, name) => {
  const m = html.match(re);
  if (!m) throw new Error('추출 실패: ' + name);
  return m[0];
};

const title = pick(/<title>[\s\S]*?<\/title>/, 'title');
const style = pick(/<style>[\s\S]*?<\/style>/, 'style');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];

// 외부 스크립트 태그 → 라이브러리 인라인
// 치환값은 반드시 함수로 넘긴다: 문자열로 넘기면 lib 안의 $' 같은 시퀀스를
// replace()가 특수 패턴으로 해석해 본문이 통째로 중복 삽입된다.
const inlined = body.replace(
  /<script src="qrcode\.js"><\/script>/,
  () => '<script>\n' + lib + '\n</script>'
);
if (inlined.includes('src="qrcode.js"')) throw new Error('스크립트 인라인 실패');

const out = title + '\n' + style + '\n' + inlined;
fs.writeFileSync(SRC + 'malmoi-artifact.html', out, 'utf8');

// 검증
const checks = {
  '외부 로드 태그 없음': !/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)="(?!data:)/i.test(out),
  'doctype/html/body 태그 없음': !/<!DOCTYPE|<html|<body/i.test(out),
  'QR 라이브러리 포함': out.includes('QR Code Generator for JavaScript'),
  '문제 8개 (중복 없음)': (out.match(/dialect:/g) || []).length === 8,
  'QUESTIONS 1회만 선언': (out.match(/const QUESTIONS/g) || []).length === 1,
};
const failed = Object.entries(checks).filter(([, v]) => !v);
console.log(Object.entries(checks).map(([k, v]) => (v ? 'OK  ' : 'FAIL') + ' ' + k).join('\n'));
console.log('크기:', (out.length / 1024).toFixed(1) + 'KB');
if (failed.length) process.exit(1);
