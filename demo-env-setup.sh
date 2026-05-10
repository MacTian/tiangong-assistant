#!/bin/bash
# 演示用的模拟环境配置（实际使用时需要替换为真实值）
# 这个脚本会创建一个临时的 .env.local 用于演示

cat > .env.local << 'DEMOEOF'
SUPABASE_URL=https://demo.tiangong.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service
DEEPSEEK_API_KEY=sk-demo-key-for-testing
AZURE_CLIENT_ID=demo-client-id
AZURE_CLIENT_SECRET=demo-secret
AZURE_TENANT_ID=common
WECHAT_CLOUD_ENV=demo-env-id
DEMOEOF

echo "演示环境配置已写入 .env.local"
echo "注意：这些是演示用的假值，实际使用需要替换为真实的密钥！"
