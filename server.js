require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const uploadsDir = path.join(__dirname, 'uploads');

// Cấu hình Middleware
app.use(cors({
    origin: true, // cho phép tất cả các domain (phía client) truy cập vào backend
    credentials: true, // cho phép mang theo cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // cho phép các phương thức HTTP
    allowedHeaders: ['Content-Type', 'Authorization'] // cho phép các header
}));
app.use(express.json()); // để đọc dữ liệu từ JSON gửi lên
app.use(express.urlencoded({ extended: true })); // để đọc dữ liệu từ form/file tải lên(từ HTML)


// Kiểm tra thư mục uploads
if (!fs.existsSync(uploadsDir)) { // Ktra đã tạo thư mục uploads chưa
    fs.mkdirSync(uploadsDir, { recursive: true }); // nếu chưa thì tạo thư mục uploads
}
app.use('/uploads', express.static(uploadsDir)); // dùng để lấy ảnh từ backend về frontend


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