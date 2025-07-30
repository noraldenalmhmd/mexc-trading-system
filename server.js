const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MEXC API base URL
const API_BASE_URL = 'https://api.mexc.com';

// تخزين مفاتيح API (في التطبيق الحقيقي، استخدم متغيرات البيئة)
const apiKeys = {
    accessKey: 'mx0vgl9P7WkjB5JPWU',
    secretKey: '67727ed10f614043a0dfa69ea8651f73'
};

// دالة لإنشاء توقيع API
function createSignature(params, secretKey) {
    const queryString = Object.keys(params)
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');
    
    return crypto.createHmac('sha256', secretKey)
        .update(queryString)
        .digest('hex');
}

// نقطة نهاية لجلب بيانات المحفظة
app.get('/api/account', async (req, res) => {
    try {
        const timestamp = Date.now();
        const params = {
            timestamp: timestamp,
            recvWindow: 60000
        };
        
        const signature = createSignature(params, apiKeys.secretKey);
        params.signature = signature;
        
        const queryString = Object.keys(params)
            .map(key => `${key}=${params[key]}`)
            .join('&');
        
        const response = await axios.get(`${API_BASE_URL}/api/v3/account?${queryString}`, {
            headers: {
                'X-MEXC-APIKEY': apiKeys.accessKey,
                'Content-Type': 'application/json'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching account balance:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

// نقطة نهاية لجلب أسعار العملات
app.get('/api/ticker/price', async (req, res) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/v3/ticker/price`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching ticker prices:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

// نقطة نهاية لتنفيذ أوامر التداول
app.post('/api/order', async (req, res) => {
    try {
        const { symbol, side, type, quantity, price } = req.body;
        
        const timestamp = Date.now();
        const params = {
            symbol: symbol,
            side: side,
            type: type,
            quantity: quantity,
            timestamp: timestamp,
            recvWindow: 60000
        };
        
        if (price) {
            params.price = price;
        }
        
        const signature = createSignature(params, apiKeys.secretKey);
        params.signature = signature;
        
        const response = await axios.post(`${API_BASE_URL}/api/v3/order`, params, {
            headers: {
                'X-MEXC-APIKEY': apiKeys.accessKey,
                'Content-Type': 'application/json'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Error placing order:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

// نقطة نهاية لجلب سجل التداول
app.get('/api/order/history', async (req, res) => {
    try {
        const timestamp = Date.now();
        const params = {
            timestamp: timestamp,
            recvWindow: 60000,
            limit: 50
        };
        
        const signature = createSignature(params, apiKeys.secretKey);
        params.signature = signature;
        
        const queryString = Object.keys(params)
            .map(key => `${key}=${params[key]}`)
            .join('&');
        
        const response = await axios.get(`${API_BASE_URL}/api/v3/order/history?${queryString}`, {
            headers: {
                'X-MEXC-APIKEY': apiKeys.accessKey,
                'Content-Type': 'application/json'
            }
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching order history:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

// WebSocket server لتحديثات الأسعار الفورية
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // إرسال تحديثات الأسعار كل 5 ثواني
    const priceUpdateInterval = setInterval(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v3/ticker/price`);
            ws.send(JSON.stringify({
                type: 'priceUpdate',
                data: response.data
            }));
        } catch (error) {
            console.error('Error fetching prices for WebSocket:', error.message);
        }
    }, 5000);
    
    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        clearInterval(priceUpdateInterval);
    });
});

// بدء الخادم
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('WebSocket server running on port 8080');
    console.log('CORS-enabled web server running on http://localhost:3000');
});
