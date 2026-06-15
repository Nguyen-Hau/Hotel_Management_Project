const db = require('../config/db');

const errRes = (res, msg, err) => (console.error(msg, err), res.status(500).json({ message: msg, error: err.message }));

exports.getDashboard = async (req, res) => {
    try {
        const role = req.user.role, cId = req.user.id;
        const isStaff = ['Giám đốc', 'Quản lý', 'Lễ tân'].includes(role);

        // 1. Gộp toàn bộ 6 câu lệnh đếm phòng và khách hàng vào 1 truy vấn duy nhất
        const [[counts]] = await db.query(`
            SELECT 
                COUNT(*) as totalRooms,
                SUM(status = 'available') as availableRooms,
                SUM(status = 'checked_in') as occupiedRooms,
                SUM(status = 'booked') as bookedRooms,
                SUM(status = 'maintenance') as maintenanceRooms,
                AVG(price) as avgPrice,
                (SELECT COUNT(*) FROM customers) as totalCustomers,
                (SELECT COUNT(DISTINCT customer_id) FROM bookings WHERE status = 'checked_in') as currentGuests
            FROM rooms
        `);

        // 2. Gộp thống kê doanh thu hôm nay và tháng này vào làm 1 truy vấn
        const [[rev]] = await db.query(`
            SELECT 
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN total_amount ELSE 0 END) as todayRevenue,
                SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN total_amount ELSE 0 END) as monthRevenue
            FROM invoices WHERE status = 'paid'
        `);

        // Khởi tạo object stats dựa trên kết quả gộp dữ liệu
        let stats = {
            ...counts, todayRevenue: rev.todayRevenue || 0, monthRevenue: rev.monthRevenue || 0, avgPrice: Math.round(counts.avgPrice) || 0,
            occupancyRate: counts.totalRooms > 0 ? Math.round(((counts.occupiedRooms + counts.bookedRooms) / counts.totalRooms) * 100) : 0
        };

        // ========== Xử lý phần dữ liệu của STAFF ==========
        if (isStaff) {
            const [trend] = await db.query(
                `SELECT DATE_FORMAT(created_at, '%m/%Y') as label, 
                    SUM(total_amount) as value 
                FROM invoices WHERE status = 'paid' 
                GROUP BY DATE_FORMAT(created_at, '%Y-%m') 
                ORDER BY MIN(created_at) LIMIT 6`
            );
            const [[structure]] = await db.query(
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

            Object.assign(stats, {
                revenueTrend: trend, roomRevenue: structure.room, serviceRevenue: structure.service, roomTypePopularity: roomType, bookingTrend: bookTrend, topNationalities: national,
                occupancyByMonth: occMonth.map(i => ({ month: i.month, rate: Math.round((i.occ / i.total) * 100) }))
            });
        }

        // ========== Xử lý phần dữ liệu của CUSTOMER ==========
        if (role === 'customer') {
            const [[cust]] = await db.query(`
                SELECT 
                    COUNT(*) as myBookings,
                    SUM(CASE WHEN i.status = 'unpaid' THEN 1 ELSE 0 END) as unpaidInvoices,
                    SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as totalSpent
                FROM bookings b LEFT JOIN invoices i ON b.booking_id = i.booking_id WHERE b.customer_id = ?
            `, [cId]);
            Object.assign(stats, { myBookings: cust.myBookings, unpaidInvoices: cust.unpaidInvoices, totalSpent: cust.totalSpent || 0 });
        }

        return res.json(stats);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy dữ liệu dashboard', err);
    }
};

exports.getRecentActivities = async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT b.*, c.full_name as customer_name, c.phone, r.room_number, r.room_type, COALESCE(i.total_amount, 0) as total_amount FROM bookings b JOIN customers c ON b.customer_id = c.customer_id JOIN rooms r ON b.room_id = r.room_id LEFT JOIN invoices i ON b.booking_id = i.booking_id ORDER BY b.created_at DESC LIMIT 50`);
        return res.json(rows);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy hoạt động gần đây', err); 
    }
};