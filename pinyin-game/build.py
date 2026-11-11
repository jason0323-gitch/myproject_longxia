#!/usr/bin/env python3
import json,base64,pathlib
ROOT=pathlib.Path(__file__).parent
words=json.loads((ROOT/'src/words.json').read_text())
audio={p.stem:'data:audio/mpeg;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'audio').glob('*.mp3')}
html=(ROOT/'src/template.html').read_text().replace('/*STYLE*/',(ROOT/'src/style.css').read_text()).replace('/*SCRIPT*/',(ROOT/'src/app.js').read_text()).replace('/*WORDS*/',json.dumps(words,ensure_ascii=False).replace('<','\\u003c')).replace('/*AUDIO*/',json.dumps(audio,ensure_ascii=False))
(ROOT/'dist').mkdir(exist_ok=True)
(ROOT/'dist/拼读闯关-读一读二.html').write_text(html)
print(f'{len(words)} words, {len(audio)} candidate whole-word recordings, {len(html.encode())} bytes')
