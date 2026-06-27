import path from 'path';
import fs from 'fs';

let _pythonCmd: string | null = null;

/** 优先使用内置 Python（release zip 自带），否则用系统 Python */
export function getPythonCmd(): string {
  if (_pythonCmd) return _pythonCmd;
  const bundled = path.resolve(__dirname, '..', 'python', 'python.exe');
  try {
    fs.accessSync(bundled);
    _pythonCmd = bundled;
  } catch {
    _pythonCmd = 'python';
  }
  return _pythonCmd;
}
