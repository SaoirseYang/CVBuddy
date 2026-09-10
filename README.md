# 自维护网申助手（Chrome/Edge 插件 v0.1）

可自己维护的网申自动填写助手。针对牛客"网申申助手"的三个短板做了针对性设计：

1. **分段表单循环填写**：填一段 → 自动点"保存/确定" → 自动点"添加/＋" → 继续下一段；
2. **策略自适应**：自动识别"从最高学历填起 / 从高中填起 / 不需要填高中"等要求，顺序与范围自动调整，并按站点沉淀记忆；
3. **开放可维护**：站点规则全部是本地 JSON，支持教学模式手工映射、导入导出、手工编辑。

## 安装（无需构建）

1. 打开 Chrome / Edge，地址栏输入 `chrome://extensions`（Edge 为 `edge://extensions`）；
2. 打开右上角（Edge 为左侧）"开发者模式"；
3. 点击"加载已解压的扩展程序"，选择本目录 `wangshen-assistant` 文件夹；
4. 建议把插件图标固定到工具栏。

## 使用

1. 先点插件图标 → "打开资料库"，把基本信息、教育经历（含高中）、实习/项目、奖项填好；
2. 打开目标网申页面，点插件图标 → 选好顺序/高中策略（默认"自动"）→ **开始填写本页**；
3. 右侧日志会实时显示进度；填完**人工核对后再提交**（插件永远不会自动点"提交"）；
4. 遇到词典没覆盖的字段：打开"教学模式"，手动填该格子时右下角会出现映射面板，选一下对应的资料项即写入该站点规则，下次全自动；
5. **帮插件进化**：在目标页面点"导出页面快照"，把下载的 HTML 放进 `site-cases/` 文件夹（见其中说明），可用于离线生成该站点的内置规则。

### 内置站点规则

`src/shared/builtin-rules.js` 存放随插件分发的站点规则（域名匹配、用户规则优先级更高）。已有 Moka 系统（app.mokahr.com）、英特尔校招（chinacampus.jobs.intel.cn）、中华英才网（applyjob.chinahr.com）三个种子条目，会随快照分析持续充实。规则可自定义 `ui.addWords`（添加按钮文案）、`ui.saveWords`（保存按钮文案）、`ui.sectionHints`（区块标题关键词）。

### 策略自适应说明

优先级：**弹窗手动选择 > 站点规则沉淀 > 页面文本推断 > 默认（最新优先、全量）**。

- 页面出现"请从最高学历开始填写"→ 自动最新优先；出现"从高中填起"→ 自动最早优先；
- 页面出现"无需填高中"→ 自动过滤高中段；
- 每次填写后，生效的策略会写入该站点规则，下次打开同一站点自动套用。

### DeepSeek AI 兜底（可选）

在"资料库 → 设置与备份"里填入 DeepSeek API Key 并开启。本地词典和站点规则都没命中的字段才会请求 AI，识别结果会自动写回站点规则缓存（越用越准）。**不填 Key 完全不影响其他功能。**

## 站点规则格式（rules 数据）

```json
{
  "domain": "career.xxx.com",
  "fieldRules": [
    { "match": { "label": "毕业院校" }, "from": "edu.school" },
    { "match": { "name": "candidateName" }, "from": "basic.name" }
  ],
  "strategy": { "order": "earliest-first", "includeLevels": ["硕士", "本科", "高中"] }
}
```

- `from` 可用路径见 `src/shared/dictionary.js`（basic.* / edu.* / work.* / prj.* / awd.*）；
- `strategy.includeLevels` 删掉 "高中" 即表示该站点不填高中。

## 目录结构

```
wangshen-assistant/
├── manifest.json            # MV3 清单
├── src/
│   ├── background/index.js  # DeepSeek AI 兜底请求（绕过 CORS）
│   ├── content/
│   │   ├── scanner.js       # 字段扫描与 label 推断
│   │   ├── filler.js        # 值适配器（input/select/radio/date...）
│   │   ├── strategy.js      # 策略自适应（顺序/范围）
│   │   ├── controller.js    # 流程控制：分段循环/单页多段/AI兜底
│   │   └── teach.js         # 教学模式
│   ├── shared/
│   │   ├── dictionary.js    # 本地词典（持续扩充）
│   │   └── storage.js       # chrome.storage 封装
│   ├── popup/               # 填写控制台
│   └── options/             # 资料库 + 规则管理 + 备份
```

## 当前限制（v0.1 → 后续迭代）

- 上传类控件（照片/附件简历）暂不支持自动上传；
- 级联选择器（省市区/院校库）和复杂日历组件的适配会在后续版本逐个积累；
- "添加"按钮的识别基于常见文案（添加/新增/＋），个别站点需用教学模式或手工处理；
- 表格里的 label 推断对非常规 DOM 结构可能失效，此时用教学模式补规则即可。
