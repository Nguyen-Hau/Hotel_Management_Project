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

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/employees', employeesRoutes);

// Endpoint kiểm tra hệ thống
app.get('/api/test', function(req, res) {
    return res.json({ message: 'API is working!' });
});

app.get('/api/health', function(req, res) {
    return res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString() 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
    console.log('=== SERVER STARTED ===');
    console.log('Server dang chay tai port: ' + PORT);
});