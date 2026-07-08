require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const uploadsDir = path.join(__dirname, 'uploads');

// Cấu hình Middleware
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Kiểm tra thư mục uploads
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Khai báo thủ công từng tuyến đường (Route)
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const roomsRoutes = require('./routes/rooms.routes');
const customersRoutes = require('./routes/customers.routes');
const usersRoutes = require('./routes/users.routes');
const servicesRoutes = require('./routes/services.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const invoicesRoutes = require('./routes/invoices.routes');
const employeesRoutes = require('./routes/employees.routes');

app.use('/api/auth', authRoutes); // Đăng nhập và đăng ký tài khoản
app.use('/api/dashboard', dashboardRoutes); // Dashboard
app.use('/api/rooms', roomsRoutes); // Phòng
app.use('/api/customers', customersRoutes); // Khách hàng
app.use('/api/users', usersRoutes); // Người dùng
app.use('/api/services', servicesRoutes); // Dịch vụ
app.use('/api/bookings', bookingsRoutes); // Đặt phòng
app.use('/api/invoices', invoicesRoutes); // Hóa đơn
app.use('/api/employees', employeesRoutes); // Nhân viên

// Endpoint kiểm tra hệ thống
app.get('/api/test', function (req, res) {
    return res.json({ message: 'API is working!' });
});

app.get('/api/health', function (req, res) {
    return res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log('=== SERVER STARTED ===');
    console.log('Server dang chay tai port: ' + PORT);
});