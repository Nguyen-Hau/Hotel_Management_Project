const DashboardService = require('../services/dashboard.service');

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
        const stats = await DashboardService.getDashboard(req.user);
        return res.json(stats);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy dữ liệu dashboard', err);
    }
}

// 2. Lấy danh sách các hoạt động đặt phòng gần đây
async function getRecentActivities(req, res) {
    try {
        const rows = await DashboardService.getRecentActivities();
        return res.json(rows);
    } catch (err) { 
        return errRes(res, 'Lỗi khi lấy hoạt động gần đây', err); 
    }
}

// 3. Thống kê doanh thu theo thời gian tùy chọn
async function getCustomRevenue(req, res) {
    try {
        const { start, end } = req.query;
        const result = await DashboardService.getCustomRevenue(start, end);
        return res.json(result);
    } catch (err) {
        if (err.message === 'PARAMS_MISSING') {
            return res.status(400).json({ message: 'Vui lòng cung cấp tham số thời gian start và end' });
        }
        return errRes(res, 'Lỗi khi lấy doanh thu tùy chọn', err);
    }
}

// 4. Lấy nhật ký hệ thống (Audit Logs)
async function getAuditLogs(req, res) {
    try {
        const rows = await DashboardService.getAuditLogs();
        return res.json(rows);
    } catch (err) {
        return errRes(res, 'Lỗi khi lấy nhật ký hệ thống', err);
    }
}

module.exports = {
    getDashboard,
    getRecentActivities,
    getCustomRevenue,
    getAuditLogs
};