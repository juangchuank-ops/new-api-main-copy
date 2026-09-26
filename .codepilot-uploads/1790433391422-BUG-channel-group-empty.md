# BUG: 渠道分组为空导致前端无法保存 / 模型广场不显示

**影响的渠道**：4 号（grok2api）、44 号（轴心国）
**严重级别**：中（数据不一致，非崩溃）
**状态**：已修复（数据库层），**根因未修**

---

## 一、现象

1. 在 new-api 后台渠道编辑页，给渠道选择分组（如 `default`）后点保存，**前端无报错但保存不生效**，刷新后分组仍为空。
2. 该渠道的模型在「模型广场」/ 定价页**完全看不到**，但在渠道详情页里 `models` 字段明明填了一堆模型。

两个现象看似无关，实为**同一个根因**。

---

## 二、根因

`channels` 和 `abilities` 两张表的 `group` 字段存的是**空字符串 `''`**，而不是合法的分组名（如 `default`）。

### 为什么前端保存失败

new-api 前端保存渠道时会校验分组字段，空值过不了校验，请求被静默拒绝（或后端校验失败但前端没提示）。所以表现为"点了保存没反应"。

### 为什么模型广场看不到

模型广场的数据链路是：

```
abilities 表（哪些分组、有哪些模型可用）
        ×
models 表（模型元数据：名称/图标/标签/厂商）
        ↓
   前端渲染模型广场
```

`abilities` 按 `group` 建立索引。当 `group=''` 时，这个渠道的模型**不属于任何分组**，自然无法被模型广场的查询命中。

### 为什么是个死循环

`abilities` 表主键是：

```sql
PRIMARY KEY (`group`, `model`, `channel_id`)
```

由于 `group` 是主键的一部分且为 `NOT NULL`，**无法直接 UPDATE 修改 group 值**。而在前端改分组保存 → 因为渠道 `group` 为空导致校验失败 → 失败后 `abilities` 也不会重建。于是卡死。

---

## 三、排查方法

### 查空分组的渠道

```sql
SELECT id, name, type, `group`, status
FROM channels
WHERE `group` = '';
```

### 查空分组的 abilities

```sql
SELECT channel_id, `group`, model, enabled
FROM abilities
WHERE `group` = '';
```

### 全局体检（正常应全部为 0）

```sql
SELECT
  (SELECT COUNT(*) FROM abilities WHERE `group` = '') AS abilities_empty,
  (SELECT COUNT(*) FROM channels  WHERE `group` = '') AS channels_empty;
```

### 正常的分组分布参考

```sql
-- channels：应该是 default / 站长 / 视频生成 等，不该有空串
SELECT `group`, COUNT(*) FROM channels GROUP BY `group`;

-- abilities：同上
SELECT `group`, COUNT(DISTINCT model) FROM abilities GROUP BY `group`;
```

---

## 四、修复方案（数据库层）

> **前提**：先备份，再操作。`abilities` 主键含 `group`，**不能直接 UPDATE**，必须"插新删旧"。

### 1. 备份

```bash
export $(grep -v '^#' /etc/new-api.env | xargs)   # 取 SQL_DSN
# 或用下面的变量解析
DSN=$(grep '^SQL_DSN=' /etc/new-api.env | cut -d= -f2-)
# 格式: user:pass@tcp(host:port)/dbname

mysqldump -h127.0.0.1 -P3306 -u<user> -p<pass> new_api \
  channels abilities --where="channel_id=<ID> OR id=<ID>" \
  > /root/fix-group-backup-$(date +%Y%m%d_%H%M%S).sql
```

### 2. 修复渠道表

```sql
UPDATE channels SET `group` = 'default' WHERE id = <ID>;
```

### 3. 修复 abilities 表（关键：插新 + 删旧，用事务包住）

```sql
START TRANSACTION;

-- ① 先插入 group='default' 的新记录（复制旧记录的其余字段）
INSERT INTO abilities (`group`, model, channel_id, enabled, priority, weight, tag)
SELECT 'default', model, channel_id, enabled, priority, weight, tag
FROM abilities
WHERE channel_id = <ID> AND `group` = '';

-- ② 再删除空分组的旧记录
DELETE FROM abilities WHERE channel_id = <ID> AND `group` = '';

COMMIT;
```

**注意**：如果该渠道已经存在部分 `default` 记录，第 ① 步会撞主键报错。执行前先确认：

```sql
SELECT COUNT(*) FROM abilities WHERE channel_id = <ID> AND `group` = 'default';
```

若返回值 > 0，说明已有 `default` 记录，需改用 `INSERT IGNORE` 或先处理冲突。

### 4. 重启服务加载新缓存（无 Redis，缓存在进程内存）

```bash
systemctl restart new-api
sleep 5
systemctl is-active new-api
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/status
```

### 5. 验证

```bash
# 该渠道的模型应能出现在 pricing 接口中
curl -s http://127.0.0.1:3000/api/pricing | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data') or []
names = [m.get('model_name') for m in data]
targets = ['<模型1>', '<模型2>']
missing = [t for t in targets if t not in names]
print('缺失:', missing if missing else '无')
"
```

---

## 五、批量修复脚本

把上面 2、3 步写成一键脚本，对所有空分组渠道生效：

```bash
#!/usr/bin/env bash
set -euo pipefail

DSN=$(grep '^SQL_DSN=' /etc/new-api.env | cut -d= -f2-)
UP=${DSN%%@*}; DBUSER=${UP%%:*}; DBPASS=${UP#*:}
REST=${DSN#*@}
DBNAME=$(echo "$REST" | sed 's/.*\///' | cut -d'?' -f1)

M="mysql -h127.0.0.1 -P3306 -u$DBUSER -p$DBPASS $DBNAME"

BK="/root/fix-group-all-$(date +%Y%m%d_%H%M%S).sql"
mysqldump -h127.0.0.1 -P3306 -u"$DBUSER" -p"$DBPASS" "$DBNAME" \
  channels abilities > "$BK"
echo "[OK] 备份: $BK"

IDS=$($M -N -e "SELECT GROUP_CONCAT(id) FROM channels WHERE \`group\`='';")
[ -z "$IDS" ] || [ "$IDS" = "NULL" ] && { echo "[OK] 无空分组渠道"; exit 0; }
echo "[INFO] 待修复渠道: $IDS"

$M -e "
START TRANSACTION;
INSERT INTO abilities (\`group\`,model,channel_id,enabled,priority,weight,tag)
  SELECT 'default',model,channel_id,enabled,priority,weight,tag
  FROM abilities
  WHERE \`group\`='' AND channel_id NOT IN (
    SELECT DISTINCT channel_id FROM (
      SELECT channel_id FROM abilities
      WHERE \`group\`='default' AND channel_id IN (
        SELECT id FROM channels WHERE \`group\`=''
      )
    ) t
  );
DELETE FROM abilities WHERE \`group\`='';
UPDATE channels SET \`group\`='default' WHERE \`group\`='';
COMMIT;
"

echo "[OK] 修复完成，复查:"
$M -e "SELECT (SELECT COUNT(*) FROM abilities WHERE \`group\`='') AS ab_empty,
              (SELECT COUNT(*) FROM channels  WHERE \`group\`='') AS ch_empty;"

systemctl restart new-api
sleep 5
echo "[OK] 服务状态: $(systemctl is-active new-api)"
```

**线上实测结果**：修复后 `abilities` 与 `channels` 的空分组记录均为 `0`。

---

## 六、根因未修（建议的代码层修复方向）

上面的方案只是**修数据**，没修**产生脏数据的代码**。建议在 new-api 源码里排查以下几点：

### 1. 渠道创建时的分组默认值

检查渠道新增接口，当请求未带 `group` 或传空串时，应该**兜底为 `default`**，而不是直接写入空串。

排查点：`model/channel.go` 或 `controller/channel.go` 里的 `AddChannel` / `UpdateChannel`，找 `group` 字段的赋值逻辑。

```go
// 疑似问题：group 为空时不兜底
channel.Group = strings.TrimSpace(channel.Group)
// 建议增加：
if channel.Group == "" {
    channel.Group = "default"
}
```

### 2. abilities 重建逻辑

渠道保存时应该**重建该渠道的 abilities 记录**。检查 `UpdateAbility` / `AddAbilities`，确认：

- 是否会删除该渠道的旧 abilities（如果按 `channel_id` 删，应该能覆盖空分组情况）
- 若旧记录未被清理，就会残留脏数据

```go
// 重建时应按 channel_id 全删，而不是按 (group, channel_id)
DB.Where("channel_id = ?", channel.Id).Delete(&Ability{})
```

如果原始代码是 `DB.Where("group = ? AND channel_id = ?", oldGroup, channel.Id).Delete(...)`，当 `oldGroup` 为空串时可能匹配不到或被跳过，导致残留。

### 3. 前端校验提示缺失

前端保存失败时应该弹出错误提示，而不是静默失败。这会让用户根本不知道发生了什么。

### 4. 数据迁移/导入脚本

如果这批渠道是通过脚本或 SQL 直接导入的（而非后台页面创建），检查导入脚本有没有正确写 `group` 和 `abilities`。

---

## 七、本次修复记录

| 渠道 | 名称 | 修复前 group | 修复后 | abilities |
|---|---|---|---|---|
| 44 | 轴心国 | `''` | `default` | 19 条 → `default` |
| 4 | grok2api | `''` | `default` | 5 条 → `default` |

**备份文件**（服务器 `/root/`）：
- `channel44-fixgroup-20260926_060419.sql`
- `abilities44-fixgroup-20260926_060829.sql`
- `channel4-fixgroup-20260926_142614.sql`

**已确认正常**（无需处理）：
- 38 号 geminiweb2api：`default,站长` 多分组，两个分组各有 7 条 abilities，符合预期

---

## 八、环境信息

| 项目 | 值 |
|---|---|
| 服务器 | 186.244.200.25:51988 |
| 数据库 | MySQL 127.0.0.1:3306 / `new_api` |
| 数据库账号 | `newapi`（密码见 `/etc/new-api.env` 的 `SQL_DSN`） |
| 服务 | systemd `new-api.service`，`/opt/new-api/new-api --port 3000` |
| 版本 | `0c627b5-gamefix2` |
| 缓存 | 无 Redis，渠道缓存在进程内存 → **改完必须重启** |
| 配置文件 | `/etc/new-api.env` |
| 反代 | nginx → `https://new.maoyu.cfd` |

### 常用命令

```bash
# 快速取数据库连接
DSN=$(grep '^SQL_DSN=' /etc/new-api.env | cut -d= -f2-)
UP=${DSN%%@*}; DBUSER=${UP%%:*}; DBPASS=${UP#*:}
DBNAME=$(echo "${DSN#*@}" | sed 's/.*\///' | cut -d'?' -f1)
mysql -h127.0.0.1 -P3306 -u"$DBUSER" -p"$DBPASS" "$DBNAME"

# 重启并验证
systemctl restart new-api && sleep 5 && \
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/status
```

---

## 九、一句话总结

> `channels.group` 为空串 → 前端保存校验失败 + `abilities` 无法被分组索引 → 模型广场不显示。
> 修复要动两张表，且 `abilities` 因主键含 `group` **必须"插新删旧"**，改完**必须重启服务**。
> **根因在新增渠道时对空 `group` 未做兜底，建议在源码层补默认值。**
