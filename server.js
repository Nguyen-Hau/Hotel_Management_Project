require('dotenv').config();
const express = require('express'), cors = require('cors'), path = require('path'), fs = require('fs');

const app = express(), uploadsDir = path.join(__dirname, 'uploads');

// Middleware & Static Files
app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Vòng lặp tự động nạp và khai báo toàn bộ Routes trên 4 dòng dọc
['auth', 'dashboard', 'rooms', 'customers', 'users', 'services', 'bookings', 'invoices', 'employees'].forEach(r => {
    app.use(`/api/${r}`, require(`./routes/${r}.routes`));
});

// Test & Health Check endpoints
app.get('/api/test', (req, res) => res.json({ message: 'API is working!' }));
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`
    \n========================================
    \n🚀 Server running at http://localhost:${PORT}
    \n📁 Uploads directory: ${uploadsDir}
    \n========================================\n`
));