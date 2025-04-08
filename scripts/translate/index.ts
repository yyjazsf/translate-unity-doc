import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';
import { glob } from 'glob';

// 加载环境变量
dotenv.config({ path: '.env.local' });

import { translateText } from './open_router';

const MAX_LIMIT = 1; // 每批次处理的文件数量
const WAIT_TIME = 1000; // 批次之间的等待时间（毫秒）

interface ProcessStatus {
  success: string[];
  failed: string[];
}

interface ProcessStatusMap {
  [lang: string]: ProcessStatus;
}

function getProcessStatusPath(): string {
  return path.join(__dirname, '..', '..', 'process.json');
}

function loadProcessStatus(): ProcessStatusMap {
  const statusPath = getProcessStatusPath();
  try {
    if (fs.existsSync(statusPath)) {
      const content = fs.readFileSync(statusPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('读取处理状态文件失败:', err);
  }
  return {};
}

function saveProcessStatus(statusMap: ProcessStatusMap): void {
  const statusPath = getProcessStatusPath();
  try {
    fs.writeFileSync(statusPath, JSON.stringify(statusMap, null, 2));
  } catch (err) {
    console.error('保存处理状态文件失败:', err);
  }
}

function ensureProcessStatus(targetLang: string): void {
  const statusMap = loadProcessStatus();
  if (!statusMap[targetLang]) {
    statusMap[targetLang] = { success: [], failed: [] };
    saveProcessStatus(statusMap);
  }
}

async function batchTranslateTexts(texts: string[]): Promise<string[]> {
  const BATCH_SIZE = 80;
  const batches = [];
  
  // 将文本数组分成多个批次
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }

  const results: string[] = [];
  
  // 按批次处理
  for (let i = 0; i < batches.length; i++) {
    console.log(`处理第 ${i + 1}/${batches.length} 批次翻译，共 ${batches[i].length} 条文本`);
    const batchResults = await translateText(batches[i]);
    results.push(...batchResults);
    
    // 如果不是最后一批，则等待
    if (i < batches.length - 1) {
      console.log(`等待 ${WAIT_TIME}ms 后处理下一批次翻译...`);
      await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
    }
  }
  
  return results;
}

export async function processFile(filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  if(!content) {
    debugger
  }
  const $ = cheerio.load(content);
  const texts: string[] = [];
  
  const excludePatterns = new Set([
    'unity', 'unity 6', 'unity 2023', 'unity 2024', // Unity 相关
    'c#', 'javascript', 'typescript', // 编程语言
    'github', 'git', // 工具
    'windows', 'mac', 'linux', // 操作系统
    'ios', 'android', // 移动平台
    'webgl', 'webgpu', // Web 技术
    'openxr', 'ar', 'vr', 'xr', // XR 相关
    'ai', 'ml', 'machine learning', // AI 相关
    'api', 'sdk', // 开发接口
    'fps', 'gpu', 'cpu', 'ram', // 硬件相关
    'usd', 'usdz', // 3D 格式
    'dots', 'ecs', // Unity 架构
    'hdrp', 'urp', // 渲染管线
    'lts', 'beta', 'alpha', // 版本相关
    'english', '中文', '日本語', '한국어', // 语言
    '.'
  ]);

  function shouldExclude(text: string): boolean {
    return excludePatterns.has(text.toLowerCase()) || !/[A-Za-z]/.test(text);
  }
  
  function collectTextNodes(element: cheerio.Cheerio<any>): void {
    element.contents().each((_, node) => {
      if (node.type === 'text' && node.data.trim() && node.data.trim() !== '\n') {
        const text = node.data.trim();
        if (!shouldExclude(text)) {
          texts.push(text);
        }
      } else if (node.type === 'tag') {
        collectTextNodes($(node));
      }
    });
  }

  collectTextNodes($('#master-wrapper'));

  if (texts.length > 0) {
    const translatedTexts = await batchTranslateTexts(texts);
    
    let currentIndex = 0;
    
    function replaceTextNodes(element: cheerio.Cheerio<any>): void {
      element.contents().each((_, node) => {
        if (node.type === 'text' && node.data.trim() && node.data.trim() !== '\n') {
          const text = node.data.trim();
          if (!shouldExclude(text)) {
            if(translatedTexts[currentIndex] == undefined) {
              console.log(`翻译错误${currentIndex}`)
            }
            node.data = translatedTexts[currentIndex++] || '';
          }
        } else if (node.type === 'tag') {
          replaceTextNodes($(node));
        }
      });
    }

    replaceTextNodes($('#master-wrapper'));

    fs.writeFileSync(filePath, $.html());
  }
}

export async function translateDir(targetLang: string = 'zh') {
  const dir = path.join(__dirname, '..', '..', targetLang);
  ensureProcessStatus(targetLang);
  const statusMap = loadProcessStatus();
  const processStatus = statusMap[targetLang];
  
  // 使用glob递归获取所有HTML文件
  const allFiles = await glob('**/*.html', {
    cwd: dir,
    absolute: true,
    ignore: ['node_modules/**', 'dist/**', 'build/**']
  });
  
  // 过滤掉已成功处理的文件
  const filesToProcess = allFiles
    .filter(file => !processStatus.success.includes(path.relative(dir, file)))
    .sort();

  const batches = [];
  for (let i = 0; i < filesToProcess.length; i += MAX_LIMIT) {
    batches.push(filesToProcess.slice(i, i + MAX_LIMIT));
  }

  try {
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`处理第 ${i + 1}/${batches.length} 批次，共 ${batch.length} 个文件`);
      
      const results = await Promise.allSettled(batch.map(file => processFile(file)));
      
      // 更新处理状态
      results.forEach((result, index) => {
        const file = batch[index];
        const relativePath = path.relative(dir, file);
        if (result.status === 'fulfilled') {
          processStatus.success.push(relativePath);
        } else {
          processStatus.failed.push(relativePath);
          console.error(`文件处理失败: ${relativePath}`, result.reason);
        }
      });
      
      // 保存当前处理状态
      statusMap[targetLang] = processStatus;
      saveProcessStatus(statusMap);
      
      console.log(`第 ${i + 1} 批次处理完成`);
      
      if (i < batches.length - 1) {
        console.log(`等待 ${WAIT_TIME}ms 后处理下一批次...`);
        await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
      }
    }
    
    console.log('所有文件处理完成');
    console.log(`成功: ${processStatus.success.length} 个文件`);
    console.log(`失败: ${processStatus.failed.length} 个文件`);
    
  } catch (err) {
    console.error('处理过程中发生错误:', err);
    // 保存当前处理状态
    statusMap[targetLang] = processStatus;
    saveProcessStatus(statusMap);
    throw err;
  }
}

await translateDir('zh')
