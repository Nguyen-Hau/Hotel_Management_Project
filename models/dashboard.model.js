const db = require('../config/db');

const DashboardModel = {
    getRoomsCount: async () => {
        const [resTotal] = await db.query('SELECT COUNT(*) as total FROM rooms');
        const [resAvail] = await db.query("SELECT COUNT(*) as total FROM rooms WHERE status = 'available'");
        const [resOcc] = await db.query("SELECT COUNT(*) as total FROM rooms WHERE status = 'checked_in'");
        const [resBooked] = await db.query("SELECT COUNT(*) as total FROM rooms WHERE status = 'booked'");
        const [resMaint] = await db.query("SELECT COUNT(*) as total FROM rooms WHERE status = 'maintenance'");
        const [resPrice] = await db.query('SELECT AVG(price) as avgPrice FROM rooms');
        
        return {
            total: resTotal[0].total,
            available: resAvail[0].total,
            occupied: resOcc[0].total,
            booked: resBooked[0].total,
            maintenance: resMaint[0].total,
            avgPrice: Math.round(resPrice[0].avgPrice) || 0
        };
    },

    getCustomersCount: async () => {
        const [resCust] = await db.query('SELECT COUNT(*) as total FROM customers');
        const [resCurrent] = await db.query("SELECT COUNT(DISTINCT customer_id) as total FROM bookings WHERE status = 'checked_in'");
        return {
            total: resCust[0].total,
            currentGuests: resCurrent[0].total
        };
    },

    getRevenueToday: async (dayStr) => {
        const [res] = await db.query(
            "SELECT SUM(total_amount) as total FROM invoices WHERE status = 'paid' AND (DATE(created_at) = ? OR DATE(paid_at) = ?)", 
            [dayStr, dayStr]
        );
        return res[0].total || 0;
    },

    getRevenueMonth: async (month, year) => {
        const [res] = await db.query(
            "SELECT SUM(total_amount) as total FROM invoices WHERE status = 'paid' AND MONTH(created_at) = ? AND YEAR(created_at) = ?", 
            [month, year]
        );
        return res[0].total || 0;
    },

    getRevenueTrend: async () => {
        const [rows] = await db.query(
            `SELECT DATE_FORMAT(created_at, '%m/%Y') as label, 
                SUM(total_amount) as value 
            FROM invoices WHERE status = 'paid' 
            GROUP BY DATE_FORMAT(created_at, '%Y-%m') 
            ORDER BY MIN(created_at) LIMIT 6`
        );
        return rows;
    },

    getRevenueStructure: async () => {
        const [rows] = await db.query(
            `SELECT 
                IFNULL(SUM(room_amount), 0) as room, 
                IFNULL(SUM(service_amount), 0) as service 
            FROM invoices WHERE status = 'paid'`
        );
        return rows[0];
    },

    getOccupancyMonth: async () => {
        const [rows] = await db.query(
            `SELECT 
                DATE_FORMAT(b.check_in, '%m/%Y') as month, 
                COUNT(DISTINCT b.room_id) as occ, (SELECT COUNT(*) FROM rooms) as total 
            FROM bookings b
            WHERE b.status IN ('checked_in', 'checked_out') 
            GROUP BY DATE_FORMAT(b.check_in, '%Y-%m') 
            ORDER BY MIN(b.check_in) LIMIT 6`
        );
        return rows;
    },

    getRoomTypePopularity: async () => {
        const [rows] = await db.query(
            `SELECT r.room_type as type, COUNT(b.booking_id) as count 
            FROM rooms r 
            LEFT JOIN bookings b ON r.room_id = b.room_id 
            GROUP BY r.room_type ORDER BY count DESC`
        );
        return rows;
    },

    getBookingTrend: async () => {
        const [rows] = await db.query(
            `SELECT 
                DATE_FORMAT(created_at, '%m/%Y') as month, 
                SUM(status != 'cancelled') as bookings, 
                SUM(status = 'cancelled') as cancellations 
            FROM bookings 
            GROUP BY DATE_FORMAT(created_at, '%Y-%m') 
            ORDER BY MIN(created_at) LIMIT 6`
        );
        return rows;
    },

    getTopNationalities: async () => {
        const [rows] = await db.query(
            `SELECT 
                CASE 
                    WHEN phone LIKE '+84%' OR phone LIKE '0%' THEN 'Việt Nam' 
                    WHEN phone LIKE '+1%' THEN 'Hoa Kỳ' 
                    WHEN phone LIKE '+81%' THEN 'Nhật Bản'
                    WHEN phone LIKE '+82%' THEN 'Hàn Quốc' 
                    ELSE 'Khác' END as country, COUNT(*) as count 
            FROM customers 
            GROUP BY country 
            ORDER BY count DESC LIMIT 5`
        );
        return rows;
    },

    getCustomerStats: async (customerId) => {
        const [rows] = await db.query(`
            SELECT 
                COUNT(*) as myBookings,
                SUM(CASE WHEN i.status = 'unpaid' THEN 1 ELSE 0 END) as unpaidInvoices,
                SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as totalSpent
            FROM bookings b 
            LEFT JOIN invoices i ON b.booking_id = i.booking_id 
            WHERE b.customer_id = ?
        `, [customerId]);
        return rows[0];
    },

    getRecentActivities: async () => {
        const [rows] = await db.query(`
            SELECT b.*, c.full_name as customer_name, c.phone, r.room_number, r.room_type, COALESCE(i.total_amount, 0) as total_amount 
            FROM bookings b 
            JOIN customers c ON b.customer_id = c.customer_id 
            JOIN rooms r ON b.room_id = r.room_id 
            LEFT JOIN invoices i ON b.booking_id = i.booking_id 
            ORDER BY b.created_at DESC LIMIT 50
        `);
        return rows;
    },

    getCustomRevenueSummary: async (start, end) => {
        const [rows] = await db.query(
            `SELECT 
                IFNULL(SUM(total_amount), 0) as totalRevenue,
                IFNULL(SUM(room_amount), 0) as roomRevenue,
                IFNULL(SUM(service_amount), 0) as serviceRevenue,
                COUNT(*) as invoiceCount
             FROM invoices
             WHERE status = 'paid'
               AND paid_at >= ?
               AND paid_at <= ?`,
            [start, end]
        );
        return rows[0];
    },

    getCustomRevenueInvoices: async (start, end) => {
        const [rows] = await db.query(
            `SELECT 
                i.invoice_id,
                i.booking_id,
                c.full_name as customer_name,
                c.phone,
                r.room_number,
                r.room_type,
                i.room_amount,
                i.service_amount,
                i.total_amount,
                i.payment_method,
                i.paid_at
             FROM invoices i
             JOIN bookings b ON i.booking_id = b.booking_id
             JOIN customers c ON b.customer_id = c.customer_id
             JOIN rooms r ON b.room_id = r.room_id
             WHERE i.status = 'paid'
               AND i.paid_at >= ?
               AND i.paid_at <= ?
             ORDER BY i.paid_at DESC`,
            [start, end]
        );
        return rows;
    },

    getAuditLogs: async () => {
        const [rows] = await db.query(`
            SELECT a.*, 
                   CASE 
                       WHEN a.user_type = 'employee' THEN e.full_name
                       WHEN a.user_type = 'customer' THEN c.full_name
                       ELSE 'Ẩn danh'
                   END as performer_name,
                   CASE 
                       WHEN a.user_type = 'employee' THEN e.role
                       ELSE 'Khách hàng'
                   END as performer_role
            FROM audit_logs a
            LEFT JOIN employees e ON a.user_id = e.employee_id AND a.user_type = 'employee'
            LEFT JOIN customers c ON a.user_id = c.customer_id AND a.user_type = 'customer'
            ORDER BY a.log_id DESC LIMIT 200
        `);
        return rows;
    }
};

module.exports = DashboardModel;
