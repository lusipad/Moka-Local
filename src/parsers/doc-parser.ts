/**
 * .doc (旧版 Word 97-2003) 解析器
 * 使用 antiword 或 textract 提取文本
 */
import { execFile } from 'child_process';
import { ParseResult } from '../types';

export async function parseDoc(filePath: string): Promise<ParseResult> {
  const start = Date.now();

  // Try antiword first (lightweight, no Python dependency)
  try {
    const text = await tryAntiword(filePath);
    return { text, elapsedMs: Date.now() - start };
  } catch {
    console.log('[doc] antiword not available, trying Python textract...');
  }

  // Fallback: Python textract (handles .doc via antiword internally)
  try {
    const text = await tryTextract(filePath);
    return { text, elapsedMs: Date.now() - start };
  } catch {
    console.log('[doc] textract not available, trying olefile...');
  }

  // Last resort: Python olefile to extract raw text
  try {
    const text = await tryOlefile(filePath);
    return { text, elapsedMs: Date.now() - start };
  } catch (err) {
    throw new Error(
      '无法解析 .doc 文件。请安装 antiword 或 Python textract:\n' +
      '  Windows: 下载 antiword (http://www.winfield.demon.nl/)\n' +
      '  或: pip install textract'
    );
  }
}

function tryAntiword(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('antiword', [filePath], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
      encoding: 'buffer',
    }, (err, stdoutBuf) => {
      if (err) return reject(err);
      // antiword outputs latin1, try to decode as utf-8 first, fallback to gbk
      const buf = stdoutBuf as Buffer;
      try {
        resolve(buf.toString('utf-8'));
      } catch {
        resolve(buf.toString('latin1'));
      }
    });
  });
}

function tryTextract(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('python', ['-c', `
import sys, json
try:
    import textract
    text = textract.process(sys.argv[1]).decode('utf-8', errors='replace')
    print(json.dumps({"text": text}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`, filePath], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    }, (err, stdout) => {
      if (err) return reject(err);
      try {
        const data = JSON.parse(stdout);
        if (data.error) reject(new Error(data.error));
        else resolve(data.text);
      } catch {
        resolve(stdout);
      }
    });
  });
}

function tryOlefile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('python', ['-c', `
import sys, json, re
try:
    import olefile
    ole = olefile.OleFileIO(sys.argv[1])
    # Try to read WordDocument stream
    if ole.exists('WordDocument'):
        data = ole.openstream('WordDocument').read()
        # Extract readable text (simple approach: filter printable chars)
        text = ''.join(chr(b) for b in data if 32 <= b < 127 or b in (10, 13))
        # Try to find Chinese text in 1Table or 0Table
        for stream_name in ['1Table', '0Table']:
            if ole.exists(stream_name):
                raw = ole.openstream(stream_name).read()
                # Extract CJK characters
                cjk = re.findall(r'[\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef]+', raw.decode('utf-16-le', errors='ignore'))
                text += '\\n' + '\\n'.join(c for c in cjk if len(c) > 1)
        ole.close()
        print(json.dumps({"text": text.strip() or "(no extractable text)"}, ensure_ascii=False))
    else:
        print(json.dumps({"error": "No WordDocument stream found"}))
        sys.exit(1)
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`, filePath], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    }, (err, stdout) => {
      if (err) return reject(err);
      try {
        const data = JSON.parse(stdout);
        if (data.error) reject(new Error(data.error));
        else resolve(data.text);
      } catch {
        resolve(stdout);
      }
    });
  });
}
