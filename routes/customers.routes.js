const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const db = require('../config/db');

// Hàm bổ trợ thông báo lỗi hệ thống
function sendErrorResponse(res, err) {
    console.error(err);
    return res.status(500).json({ 
        message: err.message 
    });
}

// Tạo mảng phân quyền cho các chức năng thông thường
const VIEW_ROLES = authMiddleware.ROLES.STAFF.concat(authMiddleware.ROLES.CUSTOMER);


// 1. Lấy tất cả hoặc chi tiết bản thân khách hàng
async function getAllCustomers(req, res) {
    try {
        let sql = 'SELECT customer_id, full_name, email, phone, cccd, created_at FROM customers';
        let params = [];

        if (req.user.role === 'customer') {
            sql = sql + ' WHERE customer_id = ?';
            params.push(req.user.id);
        }
        
        sql = sql + ' ORDER BY customer_id DESC';
        const [rows] = await db.query(sql, params);
        return res.json(rows);
    } catch (err) { 
        return sendErrorResponse(res, err); 
    }
}

// 2. Lấy thông tin khách hàng theo ID cụ thể
async function getCustomerById(req, res) {
    try {
        const customerId = req.params.id;
        const [rows] = await db.query('SELECT customer_id, full_name, email, phone, cccd, created_at FROM customers WHERE customer_id = ?', [customerId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
        }

        if (req.user.role === 'customer') {
            if (rows[0].customer_id != req.user.id) {
                return res.status(403).json({ message: 'Không có quyền truy cập thông tin khách hàng này' });
            }
        }

        return res.json(rows[0]);
    } catch (err) { 
        return sendErrorResponse(res, err); 
    }
}

// 3. Cập nhật thông tin khách hàng
async function updateCustomer(req, res) {
    try {
        const customerId = req.params.id;
        const full_name = req.body.full_name;
        const email = req.body.email;
        const phone = req.body.phone;
        const cccd = req.body.cccd;
        const password = req.body.password;

        if (req.user.role === 'customer') {
            if (customerId != req.user.id) {
                return res.status(403).json({ message: 'Không có quyền sửa thông tin này' });
            }
        }

        let sql = 'UPDATE customers SET full_name = ?, email = ?, phone = ?, cccd = ?';
        let params = [full_name, email, phone, cccd];

        if (password) {
            sql = sql + ', password = ?';
            params.push(password);
        }

        sql = sql + ' WHERE customer_id = ?';
        params.push(customerId);

        await db.query(sql, params);
        return res.json({ success: true, message: 'Cập nhật khách hàng thành công' });
    } catch (err) { 
        return sendErrorResponse(res, err); 
    }
}

// 4. Xóa tài khoản khách hàng
async function removeCustomer(req, res) {
    try {
        if (req.user.role !== 'Giám đốc') {
            return res.status(403).json({ message: 'Không có quyền xóa khách hàng' });
        }
        
        const customerId = req.params.id;
        await db.query('DELETE FROM customers WHERE customer_id = ?', [customerId]);
        return res.json({ success: true, message: 'Xóa khách hàng thành công' });
    } catch (err) { 
        return sendErrorResponse(res, err); 
    }
}

router.get('/', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), getAllCustomers);
router.get('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), getCustomerById);
router.put('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(VIEW_ROLES), updateCustomer);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.requireRole(authMiddleware.ROLES.STAFF), removeCustomer);

module.exports = router;