const db = require('../config/db');

async function logAction(req, action, targetTable, targetId, oldValue = null, newValue = null) {
    try {
        let user_id = null;
        let user_type = 'employee';

        if (req && req.user) {
            user_id = req.user.id;
            if (req.user.role === 'customer') {
                user_type = 'customer';
            }
        }

        // Lấy địa chỉ IP
        const ip_address = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || null) : null;

        const sql = `
            INSERT INTO audit_logs (user_id, user_type, action, target_table, target_id, old_value, new_value, ip_address) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.query(sql, [
            user_id,
            user_type,
            action,
            targetTable,
            targetId,
            oldValue ? JSON.stringify(oldValue) : null,
            newValue ? JSON.stringify(newValue) : null,
            ip_address
        ]);
    } catch (err) {
        console.error("Lỗi ghi log hệ thống:", err);
    }
}

module.exports = {
    logAction
};
