# ✅ New API Classic UI 优化 - 部署检查清单

**项目**: New API with Classic UI Optimization  
**版本**: 1.0.0 (优化版)  
**日期**: 2026-07-05

---

## 🎯 部署前检查

### 1. 构建验证 ✅

- [x] **前端构建成功**
  - 构建时间: 10.4 秒
  - 输出目录: `web/classic/dist/`
  - 文件数量: 70+

- [x] **后端构建成功**
  - 输出文件: `new-api-optimized.exe`
  - 文件大小: 135.29 MB
  - Go 版本: 1.26.4

- [x] **优化包含验证**
  - Dashboard 优化已包含 ✅
  - 设计系统已包含 ✅
  - 组件库已包含 ✅
  - 文档已完成 ✅

---

## 📦 交付物清单

### 前端交付物

```
web/classic/dist/          ✅ 已生成
├── index.html             ✅ 1.5 kB
├── static/
│   ├── js/               ✅ 50+ 文件
│   ├── css/              ✅ 样式文件
│   ├── font/             ✅ 15+ 字体
│   └── images/           ✅ 图片资源
```

### 后端交付物

```
new-api-optimized.exe      ✅ 135.29 MB
```

### 文档交付物

```
web/classic/
├── QUICK_START.md                  ✅ 快速入门
├── COMPONENT_GUIDE.md              ✅ 组件指南
├── DESIGN.md                       ✅ 设计系统
├── UI_OPTIMIZATION.md              ✅ 优化方案
├── IMPLEMENTATION_CHECKLIST.md     ✅ 实施清单
├── PROJECT_SUMMARY.md              ✅ 项目总结
├── OPTIMIZATION_README.md          ✅ 主文档
├── CHANGELOG.md                    ✅ 变更日志
├── PROGRESS_VISUALIZATION.md       ✅ 进度可视化
├── COMPLETION_REPORT.md            ✅ 完成报告
├── PHASE_1_COMPLETION.md           ✅ 阶段报告
├── FINAL_SUMMARY.md                ✅ 最终总结
├── INDEX.md                        ✅ 文档索引
├── BUILD_REPORT.md                 ✅ 构建报告
└── FULL_BUILD_REPORT.md            ✅ 完整构建报告
```

---

## 🚀 部署步骤

### 步骤 1: 准备环境

- [ ] **服务器环境**
  - [ ] Linux/Windows 服务器
  - [ ] 已安装 Nginx/Apache
  - [ ] 已配置域名（可选）

- [ ] **数据库**
  - [ ] MySQL/PostgreSQL/SQLite 已安装
  - [ ] 数据库已创建
  - [ ] 用户权限已配置

- [ ] **Redis（可选）**
  - [ ] Redis 已安装
  - [ ] Redis 已启动

### 步骤 2: 部署前端

```bash
# 1. 复制前端文件到 Web 服务器
scp -r web/classic/dist/* user@server:/var/www/html/

# 2. 设置文件权限
ssh user@server "chmod -R 755 /var/www/html/"

# 3. 配置 Nginx
# 使用下面的 Nginx 配置模板
```

**Nginx 配置模板:**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端静态文件
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        
        # 启用 Gzip
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
        
        # 缓存控制
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
    
    # HTML 文件不缓存
    location = /index.html {
        root /var/www/html;
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] Nginx 配置已创建
- [ ] Nginx 配置已测试 (`nginx -t`)
- [ ] Nginx 已重载 (`nginx -s reload`)

### 步骤 3: 部署后端

```bash
# 1. 复制后端可执行文件
scp new-api-optimized.exe user@server:/opt/new-api/

# 2. 创建配置文件
ssh user@server "cat > /opt/new-api/.env << 'EOF'
SQL_DSN=your_database_connection_string
PORT=3000
SESSION_SECRET=your_random_secret
REDIS_CONN_STRING=redis://localhost:6379
EOF"

# 3. 设置权限
ssh user@server "chmod +x /opt/new-api/new-api-optimized.exe"

# 4. 创建 systemd 服务（Linux）
ssh user@server "cat > /etc/systemd/system/new-api.service << 'EOF'
[Unit]
Description=New API Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/opt/new-api
ExecStart=/opt/new-api/new-api-optimized
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF"

# 5. 启动服务
ssh user@server "systemctl daemon-reload"
ssh user@server "systemctl enable new-api"
ssh user@server "systemctl start new-api"
```

- [ ] 后端文件已上传
- [ ] 配置文件已创建
- [ ] 环境变量已设置
- [ ] 服务已启动
- [ ] 服务运行正常

### 步骤 4: 数据库初始化

```bash
# 连接到服务器
ssh user@server

# 运行数据库迁移（如果有）
cd /opt/new-api
./new-api-optimized --migrate

# 或手动执行 SQL 脚本
mysql -u username -p database_name < schema.sql
```

- [ ] 数据库表已创建
- [ ] 初始数据已导入
- [ ] 数据库连接已测试

---

## ✅ 部署后验证

### 1. 服务状态检查

```bash
# 检查后端服务
systemctl status new-api

# 检查端口监听
netstat -tulpn | grep 3000

# 检查 Nginx
systemctl status nginx

# 查看日志
journalctl -u new-api -f
```

- [ ] 后端服务运行中
- [ ] 端口正常监听
- [ ] Nginx 运行正常
- [ ] 无错误日志

### 2. 前端访问测试

访问: `http://your-domain.com` 或 `http://server-ip`

- [ ] 页面正常加载
- [ ] 无 404 错误
- [ ] 静态资源加载成功
- [ ] 无控制台错误

### 3. 功能测试

#### Dashboard 页面

- [ ] Dashboard 页面正常显示
- [ ] 统计卡片显示正确
- [ ] **优化效果验证**:
  - [ ] Hover 动画流畅
  - [ ] 间距统一
  - [ ] 字号合理
  - [ ] 深色模式正常

#### 基础功能

- [ ] 用户登录正常
- [ ] API 调用成功
- [ ] 数据加载正常
- [ ] 页面导航正常

#### 响应式测试

- [ ] 桌面端显示正常 (>1024px)
- [ ] 平板端显示正常 (768-1024px)
- [ ] 移动端显示正常 (<768px)

#### 深色模式测试

- [ ] 深色模式切换正常
- [ ] 颜色对比度合适
- [ ] 所有组件适配正常

### 4. 性能测试

```bash
# 使用 curl 测试响应时间
curl -o /dev/null -s -w 'Total: %{time_total}s\n' http://your-domain.com

# 使用 ab 测试并发
ab -n 1000 -c 100 http://your-domain.com/api/status
```

- [ ] 首屏加载 < 3 秒
- [ ] API 响应 < 500ms
- [ ] 并发处理正常
- [ ] 内存占用合理

---

## 🔒 安全检查

### SSL/TLS 配置（生产环境）

```bash
# 使用 Certbot 申请证书
certbot --nginx -d your-domain.com
```

- [ ] HTTPS 已配置
- [ ] 证书有效
- [ ] HTTP 重定向到 HTTPS
- [ ] 安全头已配置

### 安全配置

- [ ] 防火墙已配置
- [ ] 仅必要端口开放
- [ ] 强密码策略
- [ ] 定期备份设置
- [ ] 日志监控启用

---

## 📊 监控设置

### 日志监控

```bash
# 后端日志
tail -f /var/log/new-api/app.log

# Nginx 访问日志
tail -f /var/log/nginx/access.log

# Nginx 错误日志
tail -f /var/log/nginx/error.log
```

- [ ] 日志路径已配置
- [ ] 日志轮转已设置
- [ ] 错误告警已配置

### 性能监控

- [ ] CPU 使用率监控
- [ ] 内存使用率监控
- [ ] 磁盘空间监控
- [ ] 网络流量监控

---

## 🎉 部署完成检查

### 最终验证清单

- [ ] ✅ 前端部署成功
- [ ] ✅ 后端部署成功
- [ ] ✅ 数据库连接正常
- [ ] ✅ 所有功能正常
- [ ] ✅ 优化效果生效
- [ ] ✅ 性能达标
- [ ] ✅ 安全配置完成
- [ ] ✅ 监控已启用
- [ ] ✅ 备份已设置
- [ ] ✅ 文档已交付

---

## 📝 部署信息记录

### 环境信息

```
服务器地址: ___________________
域名: _________________________
前端路径: /var/www/html
后端路径: /opt/new-api
数据库: ________________________
Redis: _________________________
```

### 账号信息（保密）

```
数据库用户: __________________
数据库密码: __________________
管理员账号: __________________
管理员密码: __________________
```

### 访问地址

```
前端地址: http(s)://___________
API 地址: http(s)://___________/api
管理后台: http(s)://___________/console
```

---

## 🆘 故障排查

### 常见问题

#### 1. 前端页面空白

```bash
# 检查文件路径
ls -la /var/www/html/

# 检查 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 检查浏览器控制台
```

**解决方案:**
- 验证文件路径正确
- 检查 Nginx 配置中的 root 路径
- 确保 try_files 配置正确

#### 2. API 连接失败

```bash
# 检查后端服务
systemctl status new-api

# 检查端口
netstat -tulpn | grep 3000

# 检查防火墙
firewall-cmd --list-all
```

**解决方案:**
- 确保后端服务运行
- 验证端口未被占用
- 检查防火墙规则

#### 3. 数据库连接失败

```bash
# 测试数据库连接
mysql -u username -p -h localhost database_name

# 检查后端日志
journalctl -u new-api -n 100
```

**解决方案:**
- 验证数据库凭据
- 确保数据库服务运行
- 检查网络连接

---

## 📞 支持联系

### 文档

- 快速开始: `web/classic/QUICK_START.md`
- 完整构建报告: `FULL_BUILD_REPORT.md`
- 故障排查: 本文档

### 回滚计划

如果部署失败，执行回滚:

```bash
# 停止新服务
systemctl stop new-api

# 恢复旧版本
cp /backup/old-api /opt/new-api/

# 重启服务
systemctl start new-api
```

---

**部署检查完成日期**: __________  
**部署人员**: __________  
**验证人员**: __________

🎊 **祝部署顺利！**
