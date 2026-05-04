// cloudfunctions/authPollToken/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';

exports.main = async (event, context) => {
  try {
    const authRecord = await db.collection('auth_state')
      .where({ status: 'pending' })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (authRecord.data.length === 0) {
      return { code: 0, data: { status: 'no_pending' } };
    }

    const record = authRecord.data[0];

    if (new Date() > record.expiresAt) {
      await db.collection('auth_state').doc(record._id).update({
        data: { status: 'expired' }
      });
      return { code: 0, data: { status: 'expired' } };
    }

    const postBody = `client_id=${encodeURIComponent(AZURE_CLIENT_ID)}&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=${encodeURIComponent(record.deviceCode)}`;

    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postBody
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error === 'authorization_pending') {
      return { code: 0, data: { status: 'pending' } };
    }

    if (tokenData.error === 'slow_down') {
      return { code: 0, data: { status: 'slow_down' } };
    }

    if (tokenData.access_token) {
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      await db.collection('ms_graph_token').add({
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          createdAt: new Date()
        }
      });

      await db.collection('auth_state').doc(record._id).update({
        data: { status: 'authorized', authorizedAt: new Date() }
      });

      return { code: 0, data: { status: 'authorized' } };
    }

    return { code: 0, data: { status: 'error', error: tokenData.error } };
  } catch (err) {
    console.error('authPollToken error:', err);
    return { code: 500, message: '轮询异常' };
  }
};
