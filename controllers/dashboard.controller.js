const db = require('../config/db');

function errRes(res, msg, err) {
    console.error(msg, err);
    let chiTietLoi = '';
    if (err && err.message) {
        chiTietLoi = ': ' + err.message;
    }
    return res.status(500).json({ message: msg + chiTietLoi });
}

// 1. Lấy dữ liệu tổng hợp Dashboard
async function getDashboard(req, res) {
    try {
        const role = req.user.role;
        const cId = req.user.id;
        const isStaff = ['Giám đốc', 'Quản lý', 'Lễ tân'].includes(role);

        const [resTotal] = await db.query('SELECT COUNT(*) as total FROM rooms');
        const [resAvail] = await db.query("SELECT COUNT(*) as total FROM rooms WHERE status = 'available'");
        const [resOcc] = await db.query("SELECT COUNT(*) as total FROM rooms WHERE status = 'checked_in'");
        const [resBooked] = await db.query("SELECT COUNT(*) as total FROM rooms WHERE status = 'booked'");
        const [resMaint] = await db.query("SELECT COUNT(*) as total FROM rooms WHERE status = 'maintenance'");
        const [resPrice] = await db.query('SELECT AVG(price) as avgPrice FROM rooms');
        
        const [resCust] = await db.query('SELECT COUNT(*) as total FROM customers');
        const [resCurrent] = await db.query("SELECT COUNT(DISTINCT customer_id) as total FROM bookings WHERE status = 'checked_in'");

        // Xử lý lấy ngày tháng năm hiện hành để tránh lệch múi giờ database
        const bayGio = new Date();
        const nam = bayGio.getFullYear();
        const thang = String(bayGio.getMonth() + 1).padStart(2, '0');
        const ngay = String(bayGio.getDate()).padStart(2, '0');
        const chuoiNgayHomNay = nam + '-' + thang + '-' + ngay; 

        const [resRevToday] = await db.query(
            "SELECT SUM(total_amount) as total FROM invoices WHERE status = 'paid' AND (DATE(created_at) = ? OR DATE(paid_at) = ?)", 
            [chuoiNgayHomNay, chuoiNgayHomNay]
        );
        
        const [resRevMonth] = await db.query(
            "SELECT SUM(total_amount) as total FROM invoices WHERE status = 'paid' AND MONTH(created_at) = ? AND YEAR(created_at) = ?", 
            [...[Number(thang), nam]]
        );

        const totalRooms = resTotal[0].total;
        const occupiedRooms = resOcc[0].total;
        const bookedRooms = resBooked[0].total;
        const avgPrice = Math.round(resPrice[0].avgPrice) || 0;

        let occupancyRate = 0;
        if (totalRooms > 0) {
            occupancyRate = Math.round(((occupiedRooms + bookedRooms) / totalRooms) * 100);
        }

        let stats = {
            totalRooms: totalRooms,
            availableRooms: resAvail[0].total,
            occupiedRooms: occupiedRooms,
            bookedRooms: bookedRooms,
            maintenanceRooms: resMaint[0].total,
            avgPrice: avgPrice,
            totalCustomers: resCust[0].total,
            currentGuests: resCurrent[0].total,
            todayRevenue: resRevToday[0].total || 0,
            monthRevenue: resRevMonth[0].total || 0,
            occupancyRate: occupancyRate
        };

        if (isStaff) {
            const [trend] = await db.query(
                `SELECT DATE_FORMAT(created_at, '%m/%Y') as label, 
                    SUM(total_amount) as value 
                FROM invoices WHERE status = 'paid' 
                GROUP BY DATE_FORMAT(created_at, '%Y-%m') 
                ORDER BY MIN(created_at) LIMIT 6`
            );
            
            const [structure] = await db.query(
                `SELECT 
                    IFNULL(SUM(room_amount), 0) as room, 
                    IFNULL(SUM(service_amount), 0) as service 
                FROM invoices WHERE status = 'paid'`
            );
            
            const [occMonth] = await db.query(
                `SELECT 
                    DATE_FORMAT(b.check_in, '%m/%Y') as month, 
                    COUNT(DISTINCT b.room_id) as occ, (SELECT COUNT(*) FROM rooms) as total 
                FROM bookings b
                WHERE b.status IN ('checked_in', 'checked_out') 
                GROUP BY DATE_FORMAT(b.check_in, '%Y-%m') 
                ORDER BY MIN(b.check_in) LIMIT 6`
            );
            
            const [roomType] = await db.query(
                `SELECT r.room_type as type, COUNT(b.booking_id) as count 
                FROM rooms r 
                LEFT JOIN bookings b ON r.room_id = b.room_id 
                GROUP BY r.room_type ORDER BY count DESC`
            );
            
            const [bookTrend] = await db.query(
                `SELECT 
                    DATE_FORMAT(created_at, '%m/%Y') as month, 
                    SUM(status != 'cancelled') as bookings, 
                    SUM(status = 'cancelled') as cancellations 
                FROM bookings 
                GROUP BY DATE_FORMAT(created_at, '%Y-%m') 
                ORDER BY MIN(created_at) LIMIT 6`
            );
            
            const [national] = await db.query(
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

            const listOccupancy = [];
            for (let i = 0; i < occMonth.length; i++) {
                listOccupancy.push({
                    month: occMonth[i].month,
                    rate: Math.round((occMonth[i].occ / occMonth[i].total) * 100)
                });
            }

            stats.revenueTrend = trend;
            stats.roomRevenue = structure[0].room;
            stats.serviceRevenue = structure[0].service;
            stats.roomTypePopularity = roomType;
            stats.bookingTrend = bookTrend;
            stats.topNationalities = national;
            stats.occupancyByMonth = listOccupancy;
        }

        if (role === 'customer') {
            const [custRows] = await db.query(`
                SELECT 
                    COUNT(*) as myBookings,
                    SUM(CASE WHEN i.status = 'unpaid' THEN 1 ELSE 0 END) as unpaidInvoices,
                    SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as totalSpent
                FROM bookings b 
                LEFT JOIN invoices i ON b.booking_id = i.booking_id 
                WHERE b.customer_id = ?
            `, [cId]);
            
            const cust = custRows[0];
            stats.myBookings = cust.myBookings;
            stats.unpaidInvoices = cust.unpaidInvoices;
            stats.totalSpent = cust.totalSpent || 0;
        }

        return res.json(stats);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy dữ liệu dashboard', err);
    }
}

// 2. Lấy danh sách các hoạt động đặt phòng gần đây
async function getRecentActivities(req, res) {
    try {
        const [rows] = await db.query(`
            SELECT b.*, c.full_name as customer_name, c.phone, r.room_number, r.room_type, COALESCE(i.total_amount, 0) as total_amount 
            FROM bookings b 
            JOIN customers c ON b.customer_id = c.customer_id 
            JOIN rooms r ON b.room_id = r.room_id 
            LEFT JOIN invoices i ON b.booking_id = i.booking_id 
            ORDER BY b.created_at DESC LIMIT 50
        `);
        return res.json(rows);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy hoạt động gần đây', err); 
    }
}

// 3. Thống kê doanh thu theo thời gian tùy chọn
async function getCustomRevenue(req, res) {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            return res.status(400).json({ message: 'Vui lòng cung cấp tham số thời gian start và end' });
        }

        // Query summary
        const [summary] = await db.query(
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

        // Query invoice list
        const [invoices] = await db.query(
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

        return res.json({
            success: true,
            summary: summary[0],
            invoices: invoices
        });
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy doanh thu tùy chọn', err);
    }
}

module.exports = {
    getDashboard,
    getRecentActivities,
    getCustomRevenue
};