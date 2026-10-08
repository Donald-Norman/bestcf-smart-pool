# BestCF Smart Pool

一个参考 BestCF 多来源聚合思路、用于管理自有 Cloudflare 候选 IP 池的全栈项目。

## 特性

- 地区 / 运营商筛选
- 多来源 Source Adapter
- IP 去重
- Checkbox 手动选择
- Active / Backup / Locked 设计
- 综合评分接口
- D1 持久化
- Cron 自动刷新
- React + TypeScript
- Cloudflare Worker + D1
- GitHub Actions 自动部署
- iPhone Safari 响应式 UI

## 重要说明

项目不会默认携带第三方 IP 列表。生产环境请只配置你有权使用的公开数据源，并遵守对应服务的使用条款。

健康检查/测速功能应只针对你自己的、明确授权的候选基础设施；不要把系统设计成任意目标扫描器。

## 本地运行

```bash
npm install
npm run dev
```

## D1

创建数据库：

```bash
npx wrangler d1 create bestcf-smart-pool
```

把返回的 database_id 填入 `worker/wrangler.toml`。

初始化：

```bash
npx wrangler d1 execute bestcf-smart-pool --remote --file=worker/db.sql
```

## 配置数据源

可以通过 `SOURCES_JSON` 提供 JSON 数组，例如：

```json
[
  {
    "id": "source-hk",
    "name": "Authorized Source",
    "url": "https://example.com/hk.txt",
    "region": "HK",
    "carrier": "auto",
    "enabled": true
  }
]
```

生产环境建议在 Cloudflare 中配置，而不是提交到 Git。

## 管理鉴权

设置：

```bash
npx wrangler secret put ADMIN_TOKEN
```

请求：

```text
Authorization: Bearer YOUR_TOKEN
```

## 部署

```bash
npm run build
npx wrangler deploy
```

GitHub Actions 需要：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 架构

```text
Source Registry
      ↓
Candidate Fetch
      ↓
Normalize / Deduplicate
      ↓
Region / Carrier Filter
      ↓
Health / Performance Data
      ↓
Score
      ↓
Active / Backup / Locked
      ↓
Cron Rebalance
```

## 下一步

建议继续实现：

1. 多来源真实适配器
2. 测试节点/健康检查
3. 历史测试数据
4. P50/P95 延迟
5. 稳定性评分
6. 自动识别用户出口 ASN/ISP
7. 多 Pool
8. 手动锁定 IP 不被自动淘汰
9. 更新频率真正按每个 Pool 生效
10. 更严格的 schema validation 和 rate limit
