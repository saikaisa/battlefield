# 部署指南

本文档提供了军事模拟系统的详细部署步骤，包括环境准备、数据库配置、后端部署和前端部署。

## 环境要求

- JDK 11或更高版本
- Node.js 14或更高版本
- MySQL 8.0或更高版本
- Maven 3.6或更高版本

## 数据库部署

1. 安装MySQL数据库
   ```bash
   sudo apt update
   sudo apt install mysql-server
   ```

2. 启动MySQL服务
   ```bash
   sudo systemctl start mysql
   ```

3. 登录MySQL
   ```bash
   sudo mysql -u root -p
   ```

4. 创建数据库
   ```sql
   CREATE DATABASE military_simulation;
   ```

5. 创建用户并授权
   ```sql
   CREATE USER 'military_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON military_simulation.* TO 'military_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

6. 退出MySQL
   ```sql
   EXIT;
   ```

7. 导入数据库结构
   ```bash
   mysql -u military_user -p military_simulation < /path/to/schema.sql
   ```

## 后端部署

1. 修改数据库连接配置
   
   编辑`/backend/src/main/resources/application.properties`文件，修改以下配置：
   ```properties
   spring.datasource.url=jdbc:mysql://localhost:3306/military_simulation?useSSL=false&serverTimezone=UTC
   spring.datasource.username=military_user
   spring.datasource.password=your_password
   ```

2. 构建后端项目
   ```bash
   cd /path/to/military-simulation-system/backend
   mvn clean package
   ```

3. 运行后端应用
   ```bash
   java -jar target/military-simulation-0.0.1-SNAPSHOT.jar
   ```

   或者使用nohup在后台运行：
   ```bash
   nohup java -jar target/military-simulation-0.0.1-SNAPSHOT.jar > app.log 2>&1 &
   ```

4. 验证后端服务是否正常运行
   ```bash
   curl http://localhost:8080/api/hexgrid
   ```

## 前端部署

1. 安装依赖
   ```bash
   cd /path/to/military-simulation-system/frontend
   npm install
   ```

2. 修改API地址配置
   
   创建或编辑`.env.production`文件：
   ```
   VUE_APP_API_URL=http://your-server-ip:8080/api
   ```

3. 构建前端项目
   ```bash
   npm run build
   ```

4. 部署到Web服务器
   
   使用Nginx作为Web服务器：
   ```bash
   sudo apt install nginx
   ```

5. 配置Nginx
   
   创建配置文件`/etc/nginx/sites-available/military-simulation`：
   ```
   server {
       listen 80;
       server_name your-domain.com;

       root /path/to/military-simulation-system/frontend/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api/ {
           proxy_pass http://localhost:8080/api/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

6. 启用配置
   ```bash
   sudo ln -s /etc/nginx/sites-available/military-simulation /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

7. 访问系统
   
   打开浏览器，访问`http://your-domain.com`或`http://your-server-ip`

## 常见问题

1. 后端无法连接数据库
   - 检查数据库用户名和密码是否正确
   - 确认数据库服务是否正常运行
   - 检查数据库用户权限

2. 前端无法连接后端API
   - 确认后端服务是否正常运行
   - 检查API地址配置是否正确
   - 检查网络防火墙设置

3. Nginx配置问题
   - 使用`nginx -t`检查配置是否有语法错误
   - 检查日志文件`/var/log/nginx/error.log`

4. 权限问题
   - 确保Web服务器对前端目录有读取权限
   - 确保应用程序对日志目录有写入权限

## 系统维护

1. 备份数据库
   ```bash
   mysqldump -u military_user -p military_simulation > backup.sql
   ```

2. 重启后端服务
   ```bash
   # 查找进程ID
   ps aux | grep military-simulation
   
   # 停止服务
   kill <process_id>
   
   # 启动服务
   java -jar /path/to/military-simulation-0.0.1-SNAPSHOT.jar
   ```

3. 更新前端
   ```bash
   cd /path/to/military-simulation-system/frontend
   git pull
   npm install
   npm run build
   ```

4. 查看日志
   ```bash
   # 后端日志
   tail -f logs/military-simulation.log
   
   # Nginx访问日志
   tail -f /var/log/nginx/access.log
   
   # Nginx错误日志
   tail -f /var/log/nginx/error.log
   ```
