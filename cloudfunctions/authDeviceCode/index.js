// cloudfunctions/authDeviceCode/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MS_DEVICE_CODE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || 'common';

exports.main = async (event, context) => {
  try {
    const postBody = `client_id=${encodeURIComponent(AZURE_CLIENT_ID)}&scope=${encodeURIComponent('https://graph.microsoft.com/Notes.Read offline_access')}`;

    const response = await fetch(MS_DEVICE_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postBody
    });

    const deviceCodeData = await response.json();

    if (deviceCodeData.error) {
      return { code: 500, message: deviceCodeData.error_description || '获取设备码失败' };
    }

    await db.collection('auth_state').add({
      data: {
        deviceCode: deviceCodeData.device_code,
        userCode: deviceCodeData.user_code,
        verificationUrl: deviceCodeData.verification_uri,
        expiresAt: new Date(Date.now() + deviceCodeData.expires_in * 1000),
        pollInterval: deviceCodeData.interval || 5,
        status: 'pending',
        createdAt: new Date()
      }
    });

    return {
      code: 0,
      data: {
        userCode: deviceCodeData.user_code,
        verificationUrl: deviceCodeData.verification_uri,
        expiresIn: deviceCodeData.expires_in,
        message: deviceCodeData.message
      }
    };
  } catch (err) {
    console.error('authDeviceCode error:', err);
    return { code: 500, message: '授权服务异常' };
  }
};
